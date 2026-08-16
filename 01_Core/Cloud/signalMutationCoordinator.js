const crypto = require("crypto");
const { inspectSignalDraft, normalizeSignalDraft, payloadHash } = require("../../02_Core/Signals/signalDraftContract");
const { startSignalIntake } = require("../../02_Core/Signals/signalIntakeContract");

class SignalMutationCoordinator {
    constructor(options = {}) { this.assistant = options.assistant; this.store = options.store; this.clock = options.clock || (() => new Date()); this.actions = new Map(this.store.load().map((a) => [a.actionId, a])); }
    start() { return startSignalIntake(); }
    validate(input) { return inspectSignalDraft(input && input.signal, { clock: this.clock }); }
    prepare(input) {
        const draft = normalizeSignalDraft(input.signal, { clock: this.clock });
        const destination = Object.freeze({ type: "swisschart_trading_journal", databaseAlias: "primary" });
        const hash = payloadHash(draft, destination); const existing = [...this.actions.values()].find((a) => a.payloadHash === hash);
        if (existing) return publicAction(existing);
        const action = { actionId: `signal-${crypto.randomUUID()}`, status: "pending_approval", payloadHash: hash, idempotencyKey: hash, draft, destination, createdAt: this.clock().toISOString(), approvedAt: null, executedAt: null, result: null };
        this.actions.set(action.actionId, action); this.persist(); return publicAction(action);
    }
    async approve(input, requestId) {
        const action = this.actions.get(input.approvalId);
        if (!action) throw coded("SIGNAL_ACTION_NOT_FOUND");
        if (input.confirm !== true) throw coded("SIGNAL_EXPLICIT_APPROVAL_REQUIRED");
        if (input.payloadHash !== action.payloadHash) throw coded("SIGNAL_PAYLOAD_CHANGED_REAPPROVAL_REQUIRED");
        if (action.status === "completed") return { ...publicAction(action), replayed: true };
        if (action.status !== "pending_approval") throw coded("SIGNAL_ACTION_NOT_PENDING");
        action.status = "approved"; action.approvedAt = this.clock().toISOString(); this.persist();
        const result = await this.assistant.handle({ type: "capability", requestId, capability: "signal.notion", operation: "signal.notion.create", input: { draft: action.draft }, context: { approvalVerified: true, payloadHash: action.payloadHash, idempotencyKey: action.idempotencyKey }, constraints: { readOnly: false, approvedMutation: true }, metadata: { transport: "remote_mcp" }, requestedBy: "founder", source: "claude-remote-mcp", inputContractVersion: "1.0" });
        if (!result || result.status !== "completed") { action.status = "failed"; action.result = { status: result && result.status || "failed" }; this.persist(); throw coded("SIGNAL_EXECUTION_FAILED"); }
        action.status = "completed"; action.executedAt = this.clock().toISOString(); action.result = { status: "completed", tradeId: result.data.tradeId, pageId: result.data.pageId }; this.persist(); return { ...publicAction(action), replayed: false };
    }
    persist() { this.store.save([...this.actions.values()]); }
}
function publicAction(a) { return { approvalId: a.actionId, status: a.status, payloadHash: a.payloadHash, draft: a.draft, destination: "Swisschart trading journal", result: a.result || undefined, approvalRequired: a.status === "pending_approval" }; }
function coded(code) { const e = new Error(code); e.code = code; return e; }
module.exports = SignalMutationCoordinator;
