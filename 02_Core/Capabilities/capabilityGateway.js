const {
    CAPABILITY_BEHAVIORS,
    RESULT_STATUSES,
    validateCapabilityDeclaration,
    validateCapabilityRequest,
    createCapabilityResult,
    createCapabilityError
} = require("./capabilityContract");

class CapabilityGateway {
    constructor(options = {}) {
        if (!options.registry || typeof options.registry.get !== "function") {
            throw new Error("Capability Gateway requires a Capability Registry");
        }

        this.registry = options.registry;
        this.clock = options.clock || (() => new Date());
    }

    async execute(request) {
        const requestValidation = validateCapabilityRequest(request);

        if (!requestValidation.valid) {
            return this.createError(request, {
                code: "CAPABILITY_REQUEST_INVALID",
                type: "validation_error",
                message: "Capability request is invalid",
                retryable: false
            });
        }

        const adapter = this.registry.get(request.capability);

        if (!adapter) {
            return this.createError(request, {
                code: "CAPABILITY_NOT_FOUND",
                type: "resolution_error",
                message: "Requested capability is not registered",
                retryable: false
            });
        }

        const declarationValidation = validateCapabilityDeclaration(adapter.declaration);

        if (!declarationValidation.valid ||
            adapter.declaration.capabilityId !== request.capability) {
            return this.createError(request, {
                code: "CAPABILITY_DECLARATION_INVALID",
                type: "configuration_error",
                message: "Registered capability declaration is invalid",
                retryable: false
            });
        }

        const declaration = adapter.declaration;

        if (!declaration.supportedOperations.includes(request.operation)) {
            return this.createError(request, {
                code: "CAPABILITY_OPERATION_UNSUPPORTED",
                type: "validation_error",
                message: "Requested operation is not supported by the capability",
                retryable: false
            });
        }

        if (typeof adapter.execute !== "function") {
            return this.createError(request, {
                code: "CAPABILITY_EXECUTOR_UNAVAILABLE",
                type: "configuration_error",
                message: "Registered capability executor is unavailable",
                retryable: false
            });
        }

        const startedAt = this.clock().toISOString();

        try {
            const output = await adapter.execute(request, {
                declaration,
                behavior: declaration.behavior,
                readOnly: declaration.behavior === CAPABILITY_BEHAVIORS.READ_ONLY,
                mutating: declaration.behavior === CAPABILITY_BEHAVIORS.MUTATING
            });
            const completedAt = this.clock().toISOString();

            return createCapabilityResult({
                requestId: request.requestId,
                capability: request.capability,
                operation: request.operation,
                status: output && output.status || RESULT_STATUSES.COMPLETED,
                data: output && output.data || {},
                summary: output && output.summary || "Capability execution completed",
                evidence: output && output.evidence || [],
                sourceReferences: output && output.sourceReferences || [],
                recordCount: output && output.recordCount,
                timestamps: { startedAt, completedAt },
                executionMetadata: {
                    behavior: declaration.behavior,
                    executionMode: declaration.executionMode,
                    ...(output && output.executionMetadata || {})
                },
                outputContractVersion: declaration.outputContractVersion
            });
        } catch (cause) {
            return this.createError(request, {
                code: "CAPABILITY_EXECUTION_FAILED",
                type: "execution_error",
                message: "Capability execution failed",
                retryable: Boolean(cause && cause.retryable),
                internalCauseReference: cause && typeof cause.code === "string"
                    ? cause.code
                    : null
            });
        }
    }

    createError(request, details) {
        return createCapabilityError({
            ...details,
            sourceCapability: request && typeof request.capability === "string" && request.capability.trim()
                ? request.capability
                : "unknown",
            sourceOperation: request && typeof request.operation === "string" && request.operation.trim()
                ? request.operation
                : "unknown"
        });
    }
}

module.exports = CapabilityGateway;
