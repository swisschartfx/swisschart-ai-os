class SchedulerEventAdapter {
    adapt(trigger) {
        if (!trigger || typeof trigger !== "object") {
            throw new Error("Scheduler trigger must be an object");
        }

        if (!trigger.name || !trigger.executeAt) {
            throw new Error("Scheduler trigger requires name and executeAt");
        }

        const scheduledAt = trigger.executeAt instanceof Date
            ? trigger.executeAt.toISOString()
            : trigger.executeAt;

        return {
            eventType: "scheduled",
            deduplicationKey: `scheduler:${trigger.name}:${scheduledAt}`,
            source: {
                provider: "scheduler",
                adapterId: "scheduler-event-adapter.v1",
                sourceEventId: trigger.name,
                sourceReference: trigger.reference || trigger.name,
                sourceRetrievedAt: new Date().toISOString()
            },
            title: trigger.name,
            category: trigger.category || "event_evaluation",
            impact: "unknown",
            scheduledAt,
            sourceTimezone: trigger.timezone || "UTC",
            release: {
                actual: null,
                forecast: null,
                previous: null,
                unit: null,
                isReleased: trigger.released === true
            },
            dataStatus: "partial",
            metadata: trigger.metadata || {}
        };
    }
}

module.exports = SchedulerEventAdapter;
