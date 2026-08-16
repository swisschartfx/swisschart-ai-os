const REQUEST_CLASSES = Object.freeze([
    "conversation", "read", "analyze", "prepare", "action", "schedule"
]);
const MODES = Object.freeze(["read", "analyze", "action"]);
const PERIODS = Object.freeze(["current_month", "all_time", "unspecified"]);

function validateUnderstanding(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { valid: false, errors: ["understanding must be an object"] };
    }

    const requestClass = value.requestClass || legacyRequestClass(value);
    if (!REQUEST_CLASSES.includes(requestClass)) errors.push("requestClass is invalid");
    if (typeof value.originalRequest !== "string" || !value.originalRequest.trim()) {
        errors.push("originalRequest must be a non-empty string");
    }
    if (typeof value.confidence !== "number" || value.confidence < 0 ||
        value.confidence > 1) errors.push("confidence must be between 0 and 1");

    const requiresCapability = value.requiresCapability === undefined
        ? requestClass !== "conversation" && requestClass !== "prepare" &&
            requestClass !== "schedule"
        : value.requiresCapability;
    if (typeof requiresCapability !== "boolean") {
        errors.push("requiresCapability must be a boolean");
    }

    if (["read", "analyze"].includes(requestClass)) {
        requireString(value, "domain", errors);
        requireString(value, "requestedMetric", errors);
        requireString(value, "analyticalGoal", errors);
        if (!PERIODS.includes(value.period)) errors.push("period is invalid");
        if (typeof value.calculationRequired !== "boolean") {
            errors.push("calculationRequired must be a boolean");
        }
    }
    if (requiresCapability) {
        requireString(value, "capabilityCandidate", errors);
        requireString(value, "operationCandidate", errors);
    }
    return { valid: errors.length === 0, errors, requestClass, requiresCapability };
}

function requireString(value, field, errors) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
        errors.push(`${field} must be a non-empty string`);
    }
}

function legacyRequestClass(value) {
    if (value.mode === "read") return "read";
    if (value.mode === "analyze") return "analyze";
    if (value.mode === "action") return "action";
    return null;
}

module.exports = { REQUEST_CLASSES, MODES, PERIODS, validateUnderstanding };
