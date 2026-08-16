const { createCapabilityDeclaration, EXECUTION_MODES, CAPABILITY_BEHAVIORS, APPROVAL_REQUIREMENTS, LIFECYCLE_STAGES } = require("./capabilityContract");
const NotionService = require("../Services/notionService");

class TelegramSignalCapability {
    constructor(options = {}) { this.name = "signal.telegram"; this.publisher = options.publisher; this.notionService = options.notionService || new NotionService(); this.databaseId = options.databaseId || process.env.NOTION_DATABASE_ID; this.declaration = createCapabilityDeclaration({ capabilityId: this.name, domain: "publishing", version: "1.0.0", supportedOperations: ["signal.telegram.publish"], executionMode: EXECUTION_MODES.SYNCHRONOUS, behavior: CAPABILITY_BEHAVIORS.MUTATING, approvalRequirement: APPROVAL_REQUIREMENTS.REQUIRED, lifecycleSupport: [LIFECYCLE_STAGES.ACT], inputContractVersion: "1.0", outputContractVersion: "1.0" }); }
    async execute(request) {
        if (!request.context || request.context.approvalVerified !== true || !request.context.payloadHash || !request.context.idempotencyKey) throw coded("TELEGRAM_APPROVAL_REQUIRED");
        if (!this.publisher || typeof this.publisher.publishContent !== "function") throw coded("TELEGRAM_PUBLISHER_UNAVAILABLE");
        if (!["risk_management", "signal"].includes(request.input.messageRole)) throw coded("TELEGRAM_MESSAGE_ROLE_INVALID");
        const lookup = await this.notionService.getDatabaseRecords({ databaseId: this.databaseId, filter: { property: "Trade ID", title: { equals: request.input.signalReference } } });
        if (lookup.records.length !== 1) throw coded("TELEGRAM_SIGNAL_REFERENCE_NOT_FOUND");
        const response = await this.publisher.publishContent(request.input.renderedMessage);
        if (!response || !response.message_id) throw coded("TELEGRAM_RESPONSE_UNVERIFIED");
        return { data: { published: true, messageId: response.message_id, signalReference: request.input.signalReference, messageRole: request.input.messageRole }, summary: "Approved signal bundle message published", evidence: [`telegram_message:${response.message_id}`], sourceReferences: [String(response.message_id)], recordCount: 1, executionMetadata: { destination: "telegram.primary", idempotencyKey: request.context.idempotencyKey, messageRole: request.input.messageRole } };
    }
}
function coded(code) { const e = new Error(code); e.code = code; return e; }
module.exports = TelegramSignalCapability;
