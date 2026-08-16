const LLM_PROVIDER_CONTRACT_VERSION = "1.0";

function validateProviderRequest(request) {
    const errors = [];
    if (!isObject(request)) errors.push("request must be an object");
    if (!request || typeof request.input !== "string" || !request.input.trim()) {
        errors.push("input must be a non-empty string");
    }
    if (!request || !isObject(request.schema)) errors.push("schema must be an object");
    if (!request || typeof request.activity !== "string" || !request.activity.trim()) {
        errors.push("activity must be a non-empty string");
    }
    return { valid: errors.length === 0, errors };
}

function normalizeUsage(usage = {}) {
    return {
        inputTokens: integerOrNull(usage.input_tokens),
        outputTokens: integerOrNull(usage.output_tokens),
        totalTokens: integerOrNull(usage.total_tokens),
        cachedInputTokens: integerOrNull(
            usage.input_tokens_details && usage.input_tokens_details.cached_tokens
        )
    };
}

function createProviderError(code, type, message, retryable, provider, causeReference) {
    return {
        contractVersion: LLM_PROVIDER_CONTRACT_VERSION,
        code,
        type,
        message,
        retryable,
        provider,
        internalCauseReference: causeReference || null
    };
}

function integerOrNull(value) {
    return Number.isInteger(value) && value >= 0 ? value : null;
}

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
    LLM_PROVIDER_CONTRACT_VERSION,
    validateProviderRequest,
    normalizeUsage,
    createProviderError
};
