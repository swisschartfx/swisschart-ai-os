const RULE_MODES = Object.freeze({
    AUTOMATIC: "AUTOMATIC",
    APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
    NOTIFICATION_ONLY: "NOTIFICATION_ONLY",
    DISABLED: "DISABLED"
});

const RULE_STATUSES = Object.freeze({
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE"
});

const REQUIRED_RULE_FIELDS = Object.freeze([
    "id",
    "name",
    "scope",
    "action",
    "mode",
    "priority",
    "status",
    "createdBy",
    "createdAt",
    "updatedAt"
]);

function validateRule(rule) {
    const errors = [];

    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        return {
            valid: false,
            errors: [error("RULE_REQUIRED", "rule", "rule must be an object")]
        };
    }

    for (const field of REQUIRED_RULE_FIELDS) {
        if (rule[field] === undefined || rule[field] === null || rule[field] === "") {
            errors.push(error("RULE_FIELD_REQUIRED", field, `${field} is required`));
        }
    }

    if (rule.scope !== undefined && !isValidScope(rule.scope)) {
        errors.push(error(
            "RULE_SCOPE_INVALID",
            "scope",
            "scope must be a non-empty string or a plain object"
        ));
    }

    if (rule.mode !== undefined && !Object.values(RULE_MODES).includes(rule.mode)) {
        errors.push(error("RULE_MODE_INVALID", "mode", "mode is not supported"));
    }

    if (rule.status !== undefined && !Object.values(RULE_STATUSES).includes(rule.status)) {
        errors.push(error("RULE_STATUS_INVALID", "status", "status is not supported"));
    }

    if (rule.priority !== undefined && (!Number.isFinite(rule.priority) || rule.priority < 0)) {
        errors.push(error(
            "RULE_PRIORITY_INVALID",
            "priority",
            "priority must be a non-negative finite number"
        ));
    }

    for (const field of ["createdAt", "updatedAt"]) {
        if (rule[field] !== undefined && Number.isNaN(Date.parse(rule[field]))) {
            errors.push(error("RULE_TIMESTAMP_INVALID", field, `${field} must be a valid timestamp`));
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function assertValidRule(rule) {
    const validation = validateRule(rule);

    if (!validation.valid) {
        const contractError = new Error(validation.errors.map((item) => item.message).join("; "));
        contractError.code = "RULE_VALIDATION_FAILED";
        contractError.validationErrors = validation.errors;
        throw contractError;
    }

    return rule;
}

function isValidScope(scope) {
    if (typeof scope === "string") {
        return scope.trim().length > 0;
    }

    return Boolean(scope) && typeof scope === "object" && !Array.isArray(scope);
}

function error(code, field, message) {
    return { code, field, message };
}

module.exports = {
    RULE_MODES,
    RULE_STATUSES,
    REQUIRED_RULE_FIELDS,
    validateRule,
    assertValidRule
};
