const TaskEngine = require("../../01_Core/Task_Engine/02_taskEngine");
const RuleResolver = require("../../01_Core/Rule_Layer/03_ruleResolver");
const { RULE_MODES } = require("../../01_Core/Rule_Layer/01_ruleContracts");
const {
    EXECUTION_MODES,
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    LIFECYCLE_STAGES,
    RESULT_STATUSES,
    createCapabilityDeclaration
} = require("./capabilityContract");

const TELEGRAM_PUBLISH_OPERATION = "publishing.telegram.publish";

class TelegramPublishingCapability {
    constructor(options = {}) {
        this.name = "publishing.telegram";
        this.declaration = createCapabilityDeclaration({
            capabilityId: this.name,
            domain: "publishing",
            version: "1.0.0",
            supportedOperations: [TELEGRAM_PUBLISH_OPERATION],
            operationPolicies: { [TELEGRAM_PUBLISH_OPERATION]: { access: "internal" } },
            executionMode: EXECUTION_MODES.SYNCHRONOUS,
            behavior: CAPABILITY_BEHAVIORS.MUTATING,
            approvalRequirement: APPROVAL_REQUIREMENTS.REQUIRED,
            lifecycleSupport: [LIFECYCLE_STAGES.ACT],
            inputContractVersion: "1.0",
            outputContractVersion: "1.0"
        });
        this.taskEngine = options.taskEngine || new TaskEngine();
        this.ruleResolver = options.ruleResolver || new RuleResolver();

        if (typeof this.taskEngine.execute !== "function") {
            throw dependencyError("Telegram Publishing Capability requires Task Engine");
        }
        if (typeof this.ruleResolver.resolve !== "function") {
            throw dependencyError("Telegram Publishing Capability requires Rule Resolver");
        }
    }

    async execute(request) {
        validateRequest(request);

        const decision = this.ruleResolver.resolve("publishing.publish", {
            destination: "telegram.primary",
            contentType: "text"
        });

        if ([RULE_MODES.DISABLED, RULE_MODES.NOTIFICATION_ONLY].includes(decision.mode)) {
            return {
                status: RESULT_STATUSES.BLOCKED,
                data: {
                    taskId: null,
                    taskStatus: "blocked",
                    approvalStatus: null,
                    ruleMode: decision.mode
                },
                summary: "Telegram publication is blocked by the effective Founder Rule",
                evidence: [],
                sourceReferences: [],
                executionMetadata: ruleMetadata(decision)
            };
        }

        const execution = await this.taskEngine.execute({
            source: request.source,
            sourceReference: request.requestId,
            createdBy: request.requestedBy,
            intent: "content.publish",
            objective: "Publish approved Telegram text through the existing Publishing Agent.",
            capabilityRequirement: "publishing.publish",
            input: {
                message: request.input.message,
                destination: "telegram.primary",
                contentType: "text"
            },
            contextReferences: request.context.references || [],
            constraints: request.constraints,
            metadata: request.metadata,
            approval: {
                required: true,
                status: "pending",
                reason: "External Telegram publication requires explicit founder approval."
            }
        });

        return {
            status: mapResultStatus(execution.result.status),
            data: {
                taskId: execution.task.taskId,
                taskStatus: execution.task.status,
                approvalRequired: execution.task.approval.required,
                approvalStatus: execution.task.approval.status,
                blocker: execution.result.blocker || null
            },
            summary: execution.result.summary,
            evidence: [],
            sourceReferences: [execution.task.taskId],
            executionMetadata: ruleMetadata(decision)
        };
    }
}

function validateRequest(request) {
    if (!request || request.operation !== TELEGRAM_PUBLISH_OPERATION) {
        const error = new Error("Unsupported Telegram Publishing Capability operation");
        error.code = "TELEGRAM_PUBLISHING_OPERATION_UNSUPPORTED";
        throw error;
    }
    if (!request.input || typeof request.input.message !== "string" ||
        !request.input.message.trim()) {
        const error = new Error("Telegram publication message is required");
        error.code = "TELEGRAM_PUBLISHING_MESSAGE_REQUIRED";
        throw error;
    }
}

function ruleMetadata(decision) {
    return {
        ruleMode: decision.mode,
        ruleSource: decision.source,
        ruleId: decision.rule ? decision.rule.id : null,
        approvalEnforcedBy: "capability_policy"
    };
}

function mapResultStatus(status) {
    return Object.values(RESULT_STATUSES).includes(status)
        ? status
        : RESULT_STATUSES.FAILED;
}

function dependencyError(message) {
    const error = new Error(message);
    error.code = "TELEGRAM_PUBLISHING_DEPENDENCY_REQUIRED";
    return error;
}

module.exports = TelegramPublishingCapability;
module.exports.TELEGRAM_PUBLISH_OPERATION = TELEGRAM_PUBLISH_OPERATION;
