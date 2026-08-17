const crypto = require("crypto");

class GenericTelegramPublishCoordinator {
    constructor(options = {}) {
        if (!options.assistant || typeof options.assistant.handle !== "function") {
            throw coded("GENERIC_TELEGRAM_ASSISTANT_REQUIRED");
        }
        if (!options.taskEngine ||
            !options.taskEngine.founderApprovalController ||
            typeof options.taskEngine.resumeApprovedTask !== "function") {
            throw coded("GENERIC_TELEGRAM_TASK_ENGINE_REQUIRED");
        }
        if (!options.store ||
            typeof options.store.load !== "function" ||
            typeof options.store.save !== "function") {
            throw coded("GENERIC_TELEGRAM_STORE_REQUIRED");
        }

        this.assistant = options.assistant;
        this.taskEngine = options.taskEngine;
        this.store = options.store;
        this.clock = options.clock || (() => new Date());
        this.actions = new Map(
            this.store.load().map((action) => [action.actionId, action])
        );
        this.approvalQueues = new Map();
    }

    async prepare(input, requestId) {
        const payload = normalizePayload(input);
        const payloadHash = hashPayload(payload);

        const existing = [...this.actions.values()]
            .find((action) => action.payloadHash === payloadHash);

        if (existing) return expose(existing);

        const result = await this.assistant.handle({
            type: "capability",
            requestId,
            capability: "publishing.telegram",
            operation: "publishing.telegram.publish",
            input: {
                message: payload.content
            },
            context: {
                references: []
            },
            constraints: {},
            metadata: {
                transport: "remote_mcp",
                contentType: payload.content_type,
                format: payload.format
            },
            requestedBy: "founder",
            source: "claude-remote-mcp",
            inputContractVersion: "1.0"
        });

        if (!result ||
            result.status !== "blocked" ||
            !result.data ||
            !result.data.taskId ||
            result.data.approvalStatus !== "pending") {
            throw coded("GENERIC_TELEGRAM_PREPARE_FAILED");
        }

        const action = {
            actionId: `telegram-generic-${crypto.randomUUID()}`,
            status: "pending_approval",
            taskId: result.data.taskId,
            payload,
            payloadHash,
            idempotencyKey: payloadHash,
            createdAt: this.clock().toISOString(),
            result: null
        };

        this.actions.set(action.actionId, action);
        this.persist();

        return expose(action);
    }

    async approve(input) {
        const previous =
            this.approvalQueues.get(input.approvalId) || Promise.resolve();

        const current = previous
            .catch(() => {})
            .then(() => this.executeApproval(input));

        this.approvalQueues.set(input.approvalId, current);

        try {
            return await current;
        } finally {
            if (this.approvalQueues.get(input.approvalId) === current) {
                this.approvalQueues.delete(input.approvalId);
            }
        }
    }

    async executeApproval(input) {
        const action = this.actions.get(input.approvalId);

        if (!action) {
            throw coded("GENERIC_TELEGRAM_ACTION_NOT_FOUND");
        }

        if (input.confirm !== true) {
            throw coded("GENERIC_TELEGRAM_EXPLICIT_APPROVAL_REQUIRED");
        }

        if (input.payloadHash !== action.payloadHash ||
            hashPayload(action.payload) !== action.payloadHash) {
            throw coded("GENERIC_TELEGRAM_PAYLOAD_CHANGED_REAPPROVAL_REQUIRED");
        }

        if (action.status === "completed") {
            return {
                ...expose(action),
                replayed: true
            };
        }

        if (action.status !== "pending_approval") {
            throw coded("GENERIC_TELEGRAM_ACTION_NOT_PENDING");
        }

        const task =
            this.taskEngine.founderApprovalController.getTask(action.taskId);

        if (!task ||
            !task.input ||
            task.input.message !== action.payload.content ||
            task.input.destination !== "telegram.primary" ||
            task.input.contentType !== "text") {
            throw coded("GENERIC_TELEGRAM_APPROVED_PAYLOAD_MISMATCH");
        }

        this.taskEngine.founderApprovalController.approve(action.taskId);

        action.status = "approved";
        action.approvedAt = this.clock().toISOString();
        this.persist();

        let execution;

        try {
            execution =
                await this.taskEngine.resumeApprovedTask(action.taskId);
        } catch (error) {
            action.status = "failed";
            action.failedAt = this.clock().toISOString();
            action.failureCode =
                error.code || "GENERIC_TELEGRAM_EXECUTION_FAILED";
            this.persist();
            throw error;
        }

        if (!execution ||
            !execution.result ||
            execution.result.status !== "completed" ||
            !execution.result.externalReferences ||
            !execution.result.externalReferences[0] ||
            !execution.result.externalReferences[0].messageId) {
            action.status = "failed";
            action.failedAt = this.clock().toISOString();
            action.failureCode =
                "GENERIC_TELEGRAM_PROVIDER_CONFIRMATION_REQUIRED";
            this.persist();
            throw coded("GENERIC_TELEGRAM_PROVIDER_CONFIRMATION_REQUIRED");
        }

        action.status = "completed";
        action.executedAt = this.clock().toISOString();
        action.result = {
            status: "completed",
            messageId:
                execution.result.externalReferences[0].messageId,
            chatId:
                execution.result.externalReferences[0].chatId || null
        };

        this.persist();

        return {
            ...expose(action),
            replayed: false
        };
    }

    persist() {
        this.store.save([...this.actions.values()]);
    }
}

function normalizePayload(input = {}) {
    if (typeof input.content !== "string" || !input.content.trim()) {
        throw coded("GENERIC_TELEGRAM_CONTENT_REQUIRED");
    }

    const contentType = input.content_type || "text";
    const destination = input.destination || "telegram.primary";
    const format = input.format || "HTML";

    if (contentType !== "text") {
        throw coded("GENERIC_TELEGRAM_CONTENT_TYPE_UNSUPPORTED");
    }

    if (destination !== "telegram.primary") {
        throw coded("GENERIC_TELEGRAM_DESTINATION_UNSUPPORTED");
    }

    if (format !== "HTML") {
        throw coded("GENERIC_TELEGRAM_FORMAT_UNSUPPORTED");
    }

    return {
        content: input.content,
        content_type: contentType,
        destination,
        format,
        metadata:
            input.metadata && typeof input.metadata === "object"
                ? input.metadata
                : {}
    };
}

function hashPayload(payload) {
    return crypto
        .createHash("sha256")
        .update(stable(payload))
        .digest("hex");
}

function stable(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stable).join(",")}]`;
    }

    if (value && typeof value === "object") {
        return `{${Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
            .join(",")}}`;
    }

    return JSON.stringify(value);
}

function expose(action) {
    return {
        approvalId: action.actionId,
        status: action.status,
        payloadHash: action.payloadHash,
        content: action.payload.content,
        contentType: action.payload.content_type,
        destination: action.payload.destination,
        format: action.payload.format,
        approvalRequired: action.status === "pending_approval",
        result: action.result || undefined
    };
}

function coded(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

module.exports = GenericTelegramPublishCoordinator;
