const { createCapabilityDeclaration, EXECUTION_MODES, CAPABILITY_BEHAVIORS, APPROVAL_REQUIREMENTS, LIFECYCLE_STAGES } = require("./capabilityContract");

class TelegramSignalCapability {
    constructor(options = {}) { this.name = "signal.telegram"; this.publisher = options.publisher; this.tradingDataCapability = options.tradingDataCapability; this.declaration = createCapabilityDeclaration({ capabilityId: this.name, domain: "publishing", version: "1.0.0", supportedOperations: ["signal.telegram.publish"], operationPolicies: { "signal.telegram.publish": governedMutation() }, executionMode: EXECUTION_MODES.SYNCHRONOUS, behavior: CAPABILITY_BEHAVIORS.MUTATING, approvalRequirement: APPROVAL_REQUIREMENTS.REQUIRED, lifecycleSupport: [LIFECYCLE_STAGES.ACT], inputContractVersion: "1.0", outputContractVersion: "1.0" }); }
    async execute(request) {
        if (!request.context || request.context.approvalVerified !== true || !request.context.payloadHash || !request.context.idempotencyKey) throw coded("TELEGRAM_APPROVAL_REQUIRED", "DEFINITE_NOT_SENT");
        if (!this.publisher || typeof this.publisher.publishContent !== "function") throw coded("TELEGRAM_PUBLISHER_UNAVAILABLE", "DEFINITE_NOT_SENT");
        if (!this.tradingDataCapability || typeof this.tradingDataCapability.execute !== "function") throw coded("TELEGRAM_TRADING_DATA_UNAVAILABLE", "DEFINITE_NOT_SENT");
        if (!["risk_management", "signal"].includes(request.input.messageRole)) throw coded("TELEGRAM_MESSAGE_ROLE_INVALID", "DEFINITE_NOT_SENT");
        const lookup = await this.tradingDataCapability.execute({ operation: "trading.trade_reference.resolve", input: { tradeId: request.input.signalReference } });
        if (!lookup.data || lookup.data.exists !== true || lookup.data.matchCount !== 1) throw coded("TELEGRAM_SIGNAL_REFERENCE_NOT_FOUND", "DEFINITE_NOT_SENT");
        const response = await this.publisher.publishContent(request.input.renderedMessage);
        if (!response || !response.message_id) throw coded("TELEGRAM_RESPONSE_UNVERIFIED");
        return { data: { published: true, messageId: response.message_id, signalReference: request.input.signalReference, messageRole: request.input.messageRole }, summary: "Approved signal bundle message published", evidence: [`telegram_message:${response.message_id}`], sourceReferences: [String(response.message_id)], recordCount: 1, executionMetadata: { destination: "telegram.primary", idempotencyKey: request.context.idempotencyKey, messageRole: request.input.messageRole } };
    }
}
function governedMutation() { return { access: "mutation", mutationPolicy: { approvalRequired: true, payloadBindingRequired: true, idempotencyRequired: true } }; }
function coded(code, deliveryCertainty) { const e = new Error(code); e.code = code; if (deliveryCertainty) e.deliveryCertainty = deliveryCertainty; return e; }
module.exports = TelegramSignalCapability;
