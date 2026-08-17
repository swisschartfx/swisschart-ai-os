class ForexFactoryEventAdapter {
    adapt(rawEvent, context = {}) {
        if (!rawEvent || typeof rawEvent !== "object") {
            throw new Error("Forex Factory raw event must be an object");
        }

        const title = rawEvent.title || rawEvent.event;
        const currency = rawEvent.currency || rawEvent.country || null;
        const sourceTimestamp = rawEvent.scheduledAt || rawEvent.datetime || rawEvent.date ||
            context.scheduledAt || null;
        const scheduledAt = normalizeTimestamp(sourceTimestamp);
        const sourceEventId = rawEvent.id || rawEvent.eventId || null;
        const isBankHoliday = detectBankHoliday(rawEvent);
        const allDay = rawEvent.allDay === true || isBankHoliday;
        const sourceTimezone = rawEvent.timezone || context.timezone ||
            extractOffset(sourceTimestamp) || "UTC";
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
            category: rawEvent.category ||
                (isBankHoliday ? "bank_holiday" : "economic_release"),
            country: rawEvent.country || null,
            currency,
            impact: normalizeImpact(rawEvent.impact),
            tags: rawEvent.tags || [],
            scheduledAt,
            sourceTimezone,
            sourceTimestamp: sourceTimestamp || null,
            localDate: scheduledAt ? localDateFromTimestamp(sourceTimestamp, scheduledAt) : null,
            allDay,
            isBankHoliday,
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
                providerImpact: rawEvent.impact || null,
                providerActualAvailable: valueOrNull(rawEvent.actual) !== null
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

function detectBankHoliday(rawEvent) {
    if (rawEvent.bankHoliday === true) return true;
    const title = String(rawEvent.title || rawEvent.event || "").trim();
    return /\bbank holiday\b/i.test(title);
}

function normalizeTimestamp(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        const error = new Error("Forex Factory event timestamp is invalid");
        error.code = "FOREX_FACTORY_TIMESTAMP_INVALID";
        throw error;
    }
    return parsed.toISOString();
}

function extractOffset(value) {
    const match = String(value || "").match(/([+-]\d{2}:\d{2}|Z)$/i);
    return match ? match[1].toUpperCase() : null;
}

function localDateFromTimestamp(sourceTimestamp, normalizedTimestamp) {
    const source = String(sourceTimestamp || "");
    const match = source.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (match) return match[1];
    return normalizedTimestamp.slice(0, 10);
}

function valueOrNull(value) {
    return value === undefined || value === "" ? null : value;
}

module.exports = ForexFactoryEventAdapter;
