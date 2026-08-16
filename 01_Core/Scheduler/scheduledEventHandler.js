class ScheduledEventHandler {
    constructor(options = {}) {
        if (!options.eventEngine ||
            typeof options.eventEngine.ingest !== "function" ||
            typeof options.eventEngine.evaluate !== "function") {
            throw new Error("Scheduled Event Handler requires an Event Engine");
        }

        this.eventEngine = options.eventEngine;
    }

    async handle(candidate, now) {
        const ingested = await this.eventEngine.ingest(candidate);
        const evaluated = await this.eventEngine.evaluate(
            ingested.event.eventId,
            now
        );

        return {
            event: evaluated.event,
            taskExecutions: [
                ...(ingested.taskExecutions || []),
                ...(evaluated.taskExecutions || [])
            ]
        };
    }
}

function createScheduledTaskRule() {
    return {
        ruleId: "scheduled_event_task_requested",
        enabled: true,
        action: "automation.execute",
        capabilityPolicy: { automaticAllowed: false },
        matches(event) {
            return event.eventType === "scheduled" &&
                event.status === "approaching" &&
                event.metadata &&
                event.metadata.taskPayload;
        },
        createScope(event) {
            return {
                eventType: event.eventType,
                category: event.category,
                event: event.title,
                source: event.source.provider
            };
        },
        createNotificationAction(event) {
            return {
                type: "founder_notification",
                action: "founder.notify",
                eventReference: event.eventId,
                message: `${event.title} requires review.`,
                createdAt: event.statusChangedAt
            };
        },
        createTaskRequest(event) {
            const payload = event.metadata.taskPayload;
            const scheduleGrant = event.metadata.approvedScheduleGrant || null;

            return {
                source: "event",
                sourceReference: event.eventId,
                createdBy: "scheduler-runtime",
                intent: payload.intent,
                objective: payload.objective,
                capabilityRequirement: payload.capabilityRequirement,
                input: payload.input || {},
                contextReferences: [event.eventId],
                priority: payload.priority || "normal",
                approval: {
                    required: !scheduleGrant,
                    status: scheduleGrant ? "approved" : "pending",
                    reason: scheduleGrant
                        ? "Execution authorized by an approved immutable schedule revision."
                        : "Scheduled automation requires explicit founder approval."
                },
                authorization: scheduleGrant,
                idempotencyKey:
                    `scheduled-event:${event.deduplicationKey}:${event.revision}`
            };
        }
    };
}

module.exports = ScheduledEventHandler;
module.exports.createScheduledTaskRule = createScheduledTaskRule;
