const crypto = require("crypto");
const { normalizeSignalDraft } = require("../../02_Core/Signals/signalDraftContract");
const { parseTradeId } = require("../../02_Core/Signals/tradeIdContract");
const { createSignal } = require("../../03_Workflows/signalWorkflow");
const formatTelegramSignal = require("../../02_Agents/02_Publishing_Agent/utils/telegramFormatter");
const { createRiskReminder } = require("../../03_Workflows/riskReminder");

class TelegramPublishCoordinator {
    constructor(options = {}) { this.assistant = options.assistant; this.store = options.store; this.destinationId = String(options.destinationId || ""); this.clock = options.clock || (() => new Date()); this.riskMessage = options.riskMessage || createRiskReminder(); this.actions = new Map(this.store.load().map((a) => [a.actionId, recover(a, this.clock())])); this.approvalQueues = new Map(); this.persist(); }
    prepare(input) {
        if (!parseTradeId(input.signalReference)) throw coded("TELEGRAM_SIGNAL_REFERENCE_INVALID");
        const draft = normalizeSignalDraft(input.signal, { clock: this.clock });
        const signal = createSignal({ ...draft, tradeId: input.signalReference });
        const renderedMessage = formatTelegramSignal(signal);
        const payload = { signalReference: input.signalReference, riskManagementMessage: this.riskMessage, signalMessage: renderedMessage, destination: { type: "telegram_primary", chatId: this.destinationId }, metadata: { action: "signal_publish_bundle", formatVersion: "2.0", sendOrder: ["risk_management", "signal"] } };
        const hash = crypto.createHash("sha256").update(stable(payload)).digest("hex");
        const existing = [...this.actions.values()].find((a) => a.payloadHash === hash);
        if (existing) return expose(existing);
        const action = { actionId: `telegram-${crypto.randomUUID()}`, status: "pending_approval", payloadHash: hash, idempotencyKey: hash, ...payload, messages: [{ role: "risk_management", content: payload.riskManagementMessage, status: "pending", messageId: null }, { role: "signal", content: payload.signalMessage, status: "pending", messageId: null }], createdAt: this.clock().toISOString(), result: null };
        this.actions.set(action.actionId, action); this.persist(); return expose(action);
    }
    async approve(input, requestId) {
        const previous = this.approvalQueues.get(input.approvalId) || Promise.resolve();
        const current = previous.catch(() => {}).then(() => this.executeApproval(input, requestId));
        this.approvalQueues.set(input.approvalId, current);
        try { return await current; } finally { if (this.approvalQueues.get(input.approvalId) === current) this.approvalQueues.delete(input.approvalId); }
    }
    async executeApproval(input, requestId) {
        const action = this.actions.get(input.approvalId);
        if (!action) throw coded("TELEGRAM_ACTION_NOT_FOUND");
        if (input.confirm !== true) throw coded("TELEGRAM_EXPLICIT_APPROVAL_REQUIRED");
        if (input.payloadHash !== action.payloadHash) throw coded("TELEGRAM_PAYLOAD_CHANGED_REAPPROVAL_REQUIRED");
        if (action.status === "completed") return { ...expose(action), replayed: true };
        if (action.messages.some((message) => message.status === "delivery_uncertain")) throw coded("TELEGRAM_DELIVERY_REQUIRES_REVIEW");
        if (!["pending_approval", "approved", "partial_failed", "failed"].includes(action.status)) throw coded("TELEGRAM_ACTION_NOT_PENDING");
        action.status = "approved"; action.approvedAt ||= this.clock().toISOString(); this.persist();
        for (const message of action.messages) {
            if (message.status === "completed") continue;
            message.status = "sending"; message.attemptedAt = this.clock().toISOString(); this.persist();
            try {
                const result = await this.assistant.handle({ type: "capability", requestId, capability: "signal.telegram", operation: "signal.telegram.publish", input: { signalReference: action.signalReference, renderedMessage: message.content, messageRole: message.role }, context: { approvalVerified: true, payloadHash: action.payloadHash, idempotencyKey: `${action.idempotencyKey}:${message.role}`, destinationId: action.destination.chatId }, constraints: { approvedMutation: true }, metadata: { transport: "remote_mcp", bundleActionId: action.actionId }, requestedBy: "founder", source: "claude-remote-mcp", inputContractVersion: "1.0" });
                if (!result || result.status !== "completed") throw coded("TELEGRAM_EXECUTION_FAILED");
                message.status = "completed"; message.messageId = result.data.messageId; message.completedAt = this.clock().toISOString(); this.persist();
            } catch (error) {
                message.status = "failed"; message.failureCode = error.code || "TELEGRAM_EXECUTION_FAILED";
                action.status = action.messages.some((item) => item.status === "completed") ? "partial_failed" : "failed"; this.persist(); throw coded("TELEGRAM_BUNDLE_EXECUTION_INCOMPLETE");
            }
        }
        action.status = "completed"; action.executedAt = this.clock().toISOString(); action.result = { status: "completed", riskManagementMessageId: action.messages[0].messageId, signalMessageId: action.messages[1].messageId, signalReference: action.signalReference }; this.persist(); return { ...expose(action), replayed: false };
    }
    persist() { this.store.save([...this.actions.values()]); }
}
function expose(a) { return { approvalId: a.actionId, status: a.status, payloadHash: a.payloadHash, signalReference: a.signalReference, destination: "Swisschart primary Telegram channel", riskManagementMessage: a.riskManagementMessage, signalMessage: a.signalMessage, sendOrder: ["risk_management", "signal"], messageStates: (a.messages || []).map((message) => ({ role: message.role, status: message.status, messageId: message.messageId || undefined })), result: a.result || undefined, approvalRequired: a.status === "pending_approval" }; }
function recover(action, now) { if (!Array.isArray(action.messages)) return action; return { ...action, messages: action.messages.map((message) => message.status === "sending" ? { ...message, status: "delivery_uncertain", uncertainAt: now.toISOString() } : message), status: action.messages.some((message) => message.status === "sending") ? "held_for_review" : action.status }; }
function stable(v) { if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`; if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`; return JSON.stringify(v); }
function coded(code) { const e = new Error(code); e.code = code; return e; }
module.exports = TelegramPublishCoordinator;
