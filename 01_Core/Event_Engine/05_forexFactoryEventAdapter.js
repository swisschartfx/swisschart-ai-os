class ForexFactoryEventAdapter {
    adapt(rawEvent, context = {}) {
        if (!rawEvent || typeof rawEvent !== "object") {
            throw new Error("Forex Factory raw event must be an object");
        }

        const title = rawEvent.title || rawEvent.event;
        const currency = rawEvent.currency || rawEvent.country || null;
        const scheduledAt = rawEvent.scheduledAt || rawEvent.datetime ||
            context.scheduledAt || null;
        const sourceEventId = rawEvent.id || rawEvent.eventId || null;
        const deduplicationKey = sourceEventId
            ? `forex-factory:${sourceEventId}`
            : `forex-factory:${currency || "unknown"}:${title || "unknown"}:${scheduledAt || "unknown"}`;

        return {
            eventType: "economic_calendar",
            deduplicationKey,
            source: {
                provider: "forex_factory",
                adapterId: "forex-factory-event-adapter.v1",
                sourceEventId,
                sourceReference: context.sourceReference || null,
                sourceRetrievedAt: context.retrievedAt || new Date().toISOString()
            },
            title,
            category: rawEvent.category || "economic_release",
            country: rawEvent.country || null,
            currency,
            impact: normalizeImpact(rawEvent.impact),
            tags: rawEvent.tags || [],
            scheduledAt,
            sourceTimezone: rawEvent.timezone || context.timezone || "UTC",
            releaseObservedAt: rawEvent.releasedAt || null,
            release: {
                actual: valueOrNull(rawEvent.actual),
                forecast: valueOrNull(rawEvent.forecast),
                previous: valueOrNull(rawEvent.previous),
                unit: rawEvent.unit || null,
                isReleased: rawEvent.released === true || valueOrNull(rawEvent.actual) !== null
            },
            dataStatus: "partial",
            rawPayloadReference: context.rawPayloadReference || null,
            metadata: {
                providerImpact: rawEvent.impact || null
            }
        };
    }
}

function normalizeImpact(impact) {
    const value = String(impact || "").trim().toLowerCase();

    if (["high", "red", "3"].includes(value)) {
        return "high";
    }

    if (["medium", "orange", "2"].includes(value)) {
        return "medium";
    }

    if (["low", "yellow", "1"].includes(value)) {
        return "low";
    }

    return "unknown";
}

function valueOrNull(value) {
    return value === undefined || value === "" ? null : value;
}

module.exports = ForexFactoryEventAdapter;
