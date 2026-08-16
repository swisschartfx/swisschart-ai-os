const AGENT_ERROR_CODES = Object.freeze({
    REQUEST_REQUIRED: "AGENT_REQUEST_REQUIRED",
    INTENT_UNSUPPORTED: "AGENT_INTENT_UNSUPPORTED",
    INPUT_INVALID: "AGENT_INPUT_INVALID",
    DEPENDENCY_REQUIRED: "AGENT_DEPENDENCY_REQUIRED",
    EXECUTION_FAILED: "AGENT_EXECUTION_FAILED"
});

class AgentContract {
    constructor(options = {}) {
        if (typeof options.name !== "string" || !options.name.trim()) {
            throw createAgentError(
                AGENT_ERROR_CODES.INPUT_INVALID,
                "Agent name is required"
            );
        }

        if (!Array.isArray(options.supportedIntents) ||
            options.supportedIntents.some(intent =>
                typeof intent !== "string" || !intent.trim()
            )) {
            throw createAgentError(
                AGENT_ERROR_CODES.INPUT_INVALID,
                "Agent supportedIntents must be an array of strings"
            );
        }

        this.name = options.name.trim();
        this.supportedIntents = Object.freeze([
            ...options.supportedIntents
        ]);
    }

    validateRequest(request) {
        if (!request || typeof request !== "object" || Array.isArray(request)) {
            throw createAgentError(
                AGENT_ERROR_CODES.REQUEST_REQUIRED,
                "Agent request is required"
            );
        }

        if (typeof request.intent !== "string" || !request.intent.trim()) {
            throw createAgentError(
                AGENT_ERROR_CODES.INPUT_INVALID,
                "Agent request intent is required"
            );
        }

        if (!request.input ||
            typeof request.input !== "object" ||
            Array.isArray(request.input)) {
            throw createAgentError(
                AGENT_ERROR_CODES.INPUT_INVALID,
                "Agent request input must be an object"
            );
        }

        if (!this.supportedIntents.includes(request.intent)) {
            throw createAgentError(
                AGENT_ERROR_CODES.INTENT_UNSUPPORTED,
                `Unsupported ${this.name} Agent intent: ${request.intent}`
            );
        }

        return request;
    }

    createResult(request, status, output) {
        this.validateRequest(request);

        return {
            type: "agent_result",
            agent: this.name,
            intent: request.intent,
            status,
            output
        };
    }

    requireDependency(dependency, name) {
        if (!dependency) {
            throw createAgentError(
                AGENT_ERROR_CODES.DEPENDENCY_REQUIRED,
                `${name || "Agent dependency"} is required`
            );
        }

        return dependency;
    }

    createExecutionError(message, cause) {
        const error = createAgentError(
            AGENT_ERROR_CODES.EXECUTION_FAILED,
            message || "Agent execution failed"
        );

        if (cause !== undefined) {
            error.cause = cause;
        }

        return error;
    }
}

function createAgentError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

module.exports = AgentContract;
module.exports.AGENT_ERROR_CODES = AGENT_ERROR_CODES;
