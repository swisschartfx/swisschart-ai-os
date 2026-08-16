const TASK_STATUSES = Object.freeze({
    CREATED: "created",
    VALIDATED: "validated",
    AWAITING_APPROVAL: "awaiting_approval",
    QUEUED: "queued",
    ASSIGNED: "assigned",
    RUNNING: "running",
    COMPLETED: "completed",
    VALIDATION_FAILED: "validation_failed",
    BLOCKED: "blocked",
    FAILED: "failed",
    CANCELLED: "cancelled",
    REJECTED: "rejected"
});

const RESULT_STATUSES = Object.freeze({
    COMPLETED: "completed",
    FAILED: "failed",
    BLOCKED: "blocked",
    CANCELLED: "cancelled",
    REJECTED: "rejected"
});

function nowIso(clock) {
    return clock().toISOString();
}

function createTask(taskRequest, options = {}) {
    const clock = options.clock || (() => new Date());
    const idGenerator = options.idGenerator || (() => `task-${randomUUID()}`);
    const createdAt = nowIso(clock);

    return {
        taskId: idGenerator(),
        contractVersion: "1.0",
        source: taskRequest.source,
        sourceReference: taskRequest.sourceReference,
        createdBy: taskRequest.createdBy || "assistant-core",
        createdAt,
        intent: taskRequest.intent,
        objective: taskRequest.objective,
        capabilityRequirement: taskRequest.capabilityRequirement,
        input: taskRequest.input || {},
        contextReferences: taskRequest.contextReferences || [],
        constraints: taskRequest.constraints || {},
        priority: taskRequest.priority || "normal",
        approval: taskRequest.approval || {
            required: true,
            status: "pending"
        },
        validation: {
            status: "pending",
            errors: []
        },
        idempotencyKey: taskRequest.idempotencyKey || null,
        assignment: null,
        status: TASK_STATUSES.CREATED,
        attempts: [],
        executionHistory: [{
            status: TASK_STATUSES.CREATED,
            at: createdAt,
            note: "Task created"
        }],
        startedAt: null,
        completedAt: null,
        terminalReason: null,
        resultReference: null
    };
}

function validateTask(task) {
    const errors = [];
    const requiredFields = [
        "taskId",
        "source",
        "sourceReference",
        "intent",
        "objective",
        "capabilityRequirement",
        "priority"
    ];

    for (const field of requiredFields) {
        if (!task[field]) {
            errors.push({
                code: "TASK_FIELD_REQUIRED",
                field,
                message: `${field} is required`
            });
        }
    }

    if (!task.input || typeof task.input !== "object") {
        errors.push({
            code: "TASK_INPUT_REQUIRED",
            field: "input",
            message: "input must be an object"
        });
    }

    if (!task.approval || typeof task.approval !== "object") {
        errors.push({
            code: "TASK_APPROVAL_REQUIRED",
            field: "approval",
            message: "approval is required"
        });
    }

    if (task.capabilityRequirement === "publishing.publish") {
        validatePublishingInput(task.input, errors);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function validatePublishingInput(input, errors) {
    if (!input || typeof input.message !== "string" || !input.message.trim()) {
        errors.push({
            code: "PUBLISHING_MESSAGE_REQUIRED",
            field: "input.message",
            message: "A non-empty publication message is required"
        });
    } else if (input.message.length > 4096) {
        errors.push({
            code: "PUBLISHING_MESSAGE_TOO_LONG",
            field: "input.message",
            message: "Telegram text messages cannot exceed 4096 characters"
        });
    }

    if (!input || input.destination !== "telegram.primary") {
        errors.push({
            code: "PUBLISHING_DESTINATION_INVALID",
            field: "input.destination",
            message: "Only the approved destination telegram.primary is supported"
        });
    }

    if (!input || input.contentType !== "text") {
        errors.push({
            code: "PUBLISHING_CONTENT_TYPE_INVALID",
            field: "input.contentType",
            message: "Only text publication is supported in Task Engine v1"
        });
    }
}

function createResult(data, options = {}) {
    const clock = options.clock || (() => new Date());
    const idGenerator = options.idGenerator || (() => `result-${randomUUID()}`);

    return {
        resultId: idGenerator(),
        contractVersion: "1.0",
        taskId: data.taskId,
        attemptId: data.attemptId || null,
        status: data.status,
        summary: data.summary,
        producedAt: nowIso(clock),
        executor: data.executor || null,
        output: data.output || null,
        externalReferences: data.externalReferences || [],
        evidence: data.evidence || [],
        error: data.error || null,
        blocker: data.blocker || null,
        nextAction: data.nextAction || null
    };
}

module.exports = {
    TASK_STATUSES,
    RESULT_STATUSES,
    createTask,
    validateTask,
    createResult
};
const { randomUUID } = require("crypto");
