const { randomUUID } = require("crypto");

const EVENT_STATUSES = Object.freeze({
    RECEIVED: "received",
    NORMALIZED: "normalized",
    VALIDATED: "validated",
    UPCOMING: "upcoming",
    APPROACHING: "approaching",
    RELEASED: "released",
    INVALID: "invalid",
    CANCELLED: "cancelled",
    SUPERSEDED: "superseded",
    ARCHIVED: "archived",
    STALE: "stale"
});

function createEvent(candidate, options = {}) {
    const clock = options.clock || (() => new Date());
    const idGenerator = options.idGenerator || (() => `event-${randomUUID()}`);
    const receivedAt = clock().toISOString();

    return {
        eventId: idGenerator(),
        contractVersion: "1.0",
        eventType: candidate.eventType,
        deduplicationKey: candidate.deduplicationKey,
        revision: candidate.revision || 1,
        source: candidate.source || {},
        title: candidate.title,
        category: candidate.category || null,
        country: candidate.country || null,
        currency: candidate.currency || null,
        impact: candidate.impact || "unknown",
        tags: candidate.tags || [],
        scheduledAt: candidate.scheduledAt || null,
        sourceTimezone: candidate.sourceTimezone || "UTC",
        normalizedAt: receivedAt,
        releaseObservedAt: candidate.releaseObservedAt || null,
        release: candidate.release || {
            actual: null,
            forecast: null,
            previous: null,
            unit: null,
            isReleased: false
        },
        status: EVENT_STATUSES.RECEIVED,
        statusChangedAt: receivedAt,
        eventHistory: [{
            status: EVENT_STATUSES.RECEIVED,
            at: receivedAt,
            note: "Event received"
        }],
        dataStatus: candidate.dataStatus || "partial",
        validationErrors: [],
        rawPayloadReference: candidate.rawPayloadReference || null,
        triggeredRules: [],
        taskReferences: [],
        contextReferences: candidate.contextReferences || [],
        metadata: candidate.metadata || {}
    };
}

function validateEvent(event) {
    const errors = [];

    if (!event.eventType) {
        errors.push(required("eventType"));
    }

    if (!event.title) {
        errors.push(required("title"));
    }

    if (!event.deduplicationKey) {
        errors.push(required("deduplicationKey"));
    }

    if (!event.source || !event.source.provider || !event.source.adapterId) {
        errors.push({
            code: "EVENT_SOURCE_REQUIRED",
            field: "source",
            message: "source.provider and source.adapterId are required"
        });
    }

    if (!event.scheduledAt || Number.isNaN(Date.parse(event.scheduledAt))) {
        errors.push({
            code: "EVENT_SCHEDULE_REQUIRED",
            field: "scheduledAt",
            message: "scheduledAt must be a valid ISO-8601 timestamp"
        });
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function transitionEvent(event, status, note, clock) {
    const at = clock().toISOString();
    event.status = status;
    event.statusChangedAt = at;
    event.eventHistory.push({ status, at, note });
}

function required(field) {
    return {
        code: "EVENT_FIELD_REQUIRED",
        field,
        message: `${field} is required`
    };
}

module.exports = {
    EVENT_STATUSES,
    createEvent,
    validateEvent,
    transitionEvent
};
