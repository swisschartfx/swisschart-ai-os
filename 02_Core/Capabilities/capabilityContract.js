const { randomUUID } = require("crypto");

const CAPABILITY_CONTRACT_VERSION = "1.0";

const EXECUTION_MODES = Object.freeze({
    SYNCHRONOUS: "synchronous",
    ASYNCHRONOUS: "asynchronous"
});

const CAPABILITY_BEHAVIORS = Object.freeze({
    READ_ONLY: "read_only",
    MUTATING: "mutating"
});

const APPROVAL_REQUIREMENTS = Object.freeze({
    NONE: "none",
    REQUIRED: "required"
});

const LIFECYCLE_STAGES = Object.freeze({
    COLLECT: "collect",
    STORE: "store",
    ANALYZE: "analyze",
    RECOMMEND: "recommend",
    ACT: "act"
});

const RESULT_STATUSES = Object.freeze({
    COMPLETED: "completed",
    PARTIAL: "partial",
    FAILED: "failed",
    BLOCKED: "blocked"
});

function createCapabilityDeclaration(data) {
    const declaration = {
        contractVersion: CAPABILITY_CONTRACT_VERSION,
        capabilityId: data && data.capabilityId,
        domain: data && data.domain,
        version: data && data.version,
        supportedOperations: data && data.supportedOperations,
        executionMode: data && data.executionMode,
        behavior: data && data.behavior,
        approvalRequirement: data && data.approvalRequirement,
        lifecycleSupport: data && data.lifecycleSupport,
        inputContractVersion: data && data.inputContractVersion,
        outputContractVersion: data && data.outputContractVersion
    };

    assertValid(validateCapabilityDeclaration(declaration), "CAPABILITY_DECLARATION_INVALID");
    return declaration;
}

function validateCapabilityDeclaration(declaration) {
    const errors = [];

    if (!isPlainObject(declaration)) {
        return invalid("CAPABILITY_DECLARATION_REQUIRED", "declaration", "declaration must be an object");
    }

    requireString(declaration, "capabilityId", errors);
    requireString(declaration, "domain", errors);
    requireString(declaration, "version", errors);
    requireString(declaration, "inputContractVersion", errors);
    requireString(declaration, "outputContractVersion", errors);
    requireStringArray(declaration, "supportedOperations", errors, false);

    if (!Object.values(EXECUTION_MODES).includes(declaration.executionMode)) {
        errors.push(error("CAPABILITY_EXECUTION_MODE_INVALID", "executionMode", "executionMode is not supported"));
    }

    if (!Object.values(CAPABILITY_BEHAVIORS).includes(declaration.behavior)) {
        errors.push(error("CAPABILITY_BEHAVIOR_INVALID", "behavior", "behavior must be read_only or mutating"));
    }

    if (!Object.values(APPROVAL_REQUIREMENTS).includes(declaration.approvalRequirement)) {
        errors.push(error("CAPABILITY_APPROVAL_INVALID", "approvalRequirement", "approvalRequirement is not supported"));
    }

    requireStringArray(declaration, "lifecycleSupport", errors, true);
    if (Array.isArray(declaration.lifecycleSupport)) {
        declaration.lifecycleSupport.forEach((stage) => {
            if (!Object.values(LIFECYCLE_STAGES).includes(stage)) {
                errors.push(error("CAPABILITY_LIFECYCLE_INVALID", "lifecycleSupport", `Unsupported lifecycle stage: ${stage}`));
            }
        });
    }

    return validation(errors);
}

function createCapabilityRequest(data, options = {}) {
    const clock = options.clock || (() => new Date());
    const idGenerator = options.idGenerator || (() => `capability-request-${randomUUID()}`);
    const request = {
        contractVersion: CAPABILITY_CONTRACT_VERSION,
        requestId: data && data.requestId || idGenerator(),
        capability: data && data.capability,
        operation: data && data.operation,
        input: data && data.input || {},
        context: data && data.context || {},
        constraints: data && data.constraints || {},
        metadata: data && data.metadata || {},
        requestedBy: data && data.requestedBy,
        source: data && data.source,
        timestamp: data && data.timestamp || clock().toISOString(),
        inputContractVersion: data && data.inputContractVersion
    };

    assertValid(validateCapabilityRequest(request), "CAPABILITY_REQUEST_INVALID");
    return request;
}

function validateCapabilityRequest(request) {
    const errors = [];

    if (!isPlainObject(request)) {
        return invalid("CAPABILITY_REQUEST_REQUIRED", "request", "request must be an object");
    }

    ["requestId", "capability", "operation", "requestedBy", "source", "inputContractVersion"]
        .forEach((field) => requireString(request, field, errors));
    ["input", "context", "constraints", "metadata"]
        .forEach((field) => requireObject(request, field, errors));
    requireTimestamp(request, "timestamp", errors);

    return validation(errors);
}

function createCapabilityResult(data, options = {}) {
    const clock = options.clock || (() => new Date());
    const result = {
        contractVersion: CAPABILITY_CONTRACT_VERSION,
        requestId: data && data.requestId,
        capability: data && data.capability,
        operation: data && data.operation,
        status: data && data.status,
        data: data && data.data || {},
        summary: data && data.summary,
        evidence: data && data.evidence || [],
        sourceReferences: data && data.sourceReferences || [],
        recordCount: data && data.recordCount === undefined ? null : data && data.recordCount,
        timestamps: data && data.timestamps || { completedAt: clock().toISOString() },
        executionMetadata: data && data.executionMetadata || {},
        outputContractVersion: data && data.outputContractVersion
    };

    assertValid(validateCapabilityResult(result), "CAPABILITY_RESULT_INVALID");
    return result;
}

function validateCapabilityResult(result) {
    const errors = [];

    if (!isPlainObject(result)) {
        return invalid("CAPABILITY_RESULT_REQUIRED", "result", "result must be an object");
    }

    ["requestId", "capability", "operation", "summary", "outputContractVersion"]
        .forEach((field) => requireString(result, field, errors));
    if (!Object.values(RESULT_STATUSES).includes(result.status)) {
        errors.push(error("CAPABILITY_RESULT_STATUS_INVALID", "status", "status is not supported"));
    }
    requireObject(result, "data", errors);
    requireObject(result, "timestamps", errors);
    requireObject(result, "executionMetadata", errors);
    requireStringArray(result, "evidence", errors, true);
    requireStringArray(result, "sourceReferences", errors, true);
    if (result.recordCount !== null && (!Number.isInteger(result.recordCount) || result.recordCount < 0)) {
        errors.push(error("CAPABILITY_RECORD_COUNT_INVALID", "recordCount", "recordCount must be null or a non-negative integer"));
    }
    if (isPlainObject(result.timestamps)) {
        Object.keys(result.timestamps).forEach((field) => requireTimestamp(result.timestamps, field, errors, `timestamps.${field}`));
    }

    return validation(errors);
}

function createCapabilityError(data) {
    const capabilityError = {
        contractVersion: CAPABILITY_CONTRACT_VERSION,
        code: data && data.code,
        type: data && data.type,
        message: data && data.message,
        retryable: data && data.retryable,
        sourceCapability: data && data.sourceCapability,
        sourceOperation: data && data.sourceOperation,
        internalCauseReference: data && data.internalCauseReference || null
    };

    const errors = [];
    ["code", "type", "message", "sourceCapability", "sourceOperation"]
        .forEach((field) => requireString(capabilityError, field, errors));
    if (typeof capabilityError.retryable !== "boolean") {
        errors.push(error("CAPABILITY_ERROR_RETRYABLE_INVALID", "retryable", "retryable must be a boolean"));
    }
    if (capabilityError.internalCauseReference !== null &&
        (typeof capabilityError.internalCauseReference !== "string" || !capabilityError.internalCauseReference.trim())) {
        errors.push(error("CAPABILITY_ERROR_CAUSE_REFERENCE_INVALID", "internalCauseReference", "internalCauseReference must be null or a non-empty string"));
    }

    assertValid(validation(errors), "CAPABILITY_ERROR_INVALID");
    return capabilityError;
}

function requireString(target, field, errors) {
    if (typeof target[field] !== "string" || !target[field].trim()) {
        errors.push(error("CAPABILITY_FIELD_REQUIRED", field, `${field} must be a non-empty string`));
    }
}

function requireObject(target, field, errors) {
    if (!isPlainObject(target[field])) {
        errors.push(error("CAPABILITY_OBJECT_INVALID", field, `${field} must be an object`));
    }
}

function requireStringArray(target, field, errors, allowEmpty) {
    const value = target[field];
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0) ||
        value.some((item) => typeof item !== "string" || !item.trim())) {
        errors.push(error("CAPABILITY_ARRAY_INVALID", field, `${field} must be ${allowEmpty ? "an" : "a non-empty"} array of strings`));
    }
}

function requireTimestamp(target, field, errors, errorField = field) {
    if (typeof target[field] !== "string" || Number.isNaN(Date.parse(target[field]))) {
        errors.push(error("CAPABILITY_TIMESTAMP_INVALID", errorField, `${errorField} must be a valid timestamp`));
    }
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validation(errors) {
    return { valid: errors.length === 0, errors };
}

function invalid(code, field, message) {
    return validation([error(code, field, message)]);
}

function error(code, field, message) {
    return { code, field, message };
}

function assertValid(result, code) {
    if (!result.valid) {
        const contractError = new Error(result.errors.map((item) => item.message).join("; "));
        contractError.code = code;
        contractError.validationErrors = result.errors;
        throw contractError;
    }
}

module.exports = {
    CAPABILITY_CONTRACT_VERSION,
    EXECUTION_MODES,
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    LIFECYCLE_STAGES,
    RESULT_STATUSES,
    createCapabilityDeclaration,
    validateCapabilityDeclaration,
    createCapabilityRequest,
    validateCapabilityRequest,
    createCapabilityResult,
    validateCapabilityResult,
    createCapabilityError
};
