const EVENT_RULES = Object.freeze([
    Object.freeze({
        ruleId: "high_impact_event_approaching",
        enabled: true,
        action: "publishing.external",
        capabilityPolicy: Object.freeze({ automaticAllowed: false }),
        matches(event) {
            return event.eventType === "economic_calendar" &&
                event.impact === "high" &&
                event.status === "approaching";
        },
        createScope(event) {
            return createEventScope(event);
        },
        createNotificationAction(event) {
            return createFounderNotification(event);
        },
        createTaskRequest(event) {
            const currency = event.currency || event.country || "Market";
            const message =
                `High-impact economic event approaching: ${currency} — ${event.title}.`;

            return {
                source: "event",
                sourceReference: event.eventId,
                createdBy: "event-engine",
                intent: "content.publish",
                objective: "Prepare an approved alert for an approaching high-impact economic event.",
                capabilityRequirement: "publishing.publish",
                input: {
                    message,
                    destination: "telegram.primary",
                    contentType: "text"
                },
                contextReferences: [event.eventId],
                priority: "high",
                approval: {
                    required: true,
                    status: "pending",
                    reason: "External event publication requires explicit founder approval."
                },
                idempotencyKey:
                    `event:${event.eventId}:${event.revision}:high-impact-approaching`
            };
        }
    }),
    Object.freeze({
        ruleId: "scheduled_notification_approaching",
        enabled: true,
        action: "founder.notify",
        capabilityPolicy: Object.freeze({ automaticAllowed: true }),
        matches(event) {
            return event.eventType === "scheduled" &&
                event.category === "market_session" &&
                event.status === "approaching";
        },
        createScope(event) {
            return createEventScope(event);
        },
        createNotificationAction(event) {
            return createFounderNotification(event);
        },
        createTaskRequest(event) {
            return {
                source: "event",
                sourceReference: event.eventId,
                createdBy: "event-engine",
                intent: "founder.notify",
                objective: `Notify the founder about ${event.title}.`,
                capabilityRequirement: "notification.notify",
                input: {
                    message: `${event.title} is approaching.`,
                    destination: "founder"
                },
                contextReferences: [event.eventId],
                priority: "normal",
                approval: {
                    required: true,
                    status: "pending",
                    reason: "Founder Rule decision has not been applied."
                },
                idempotencyKey:
                    `event:${event.eventId}:${event.revision}:scheduled-notification`
            };
        }
    }),
    Object.freeze({
        ruleId: "economic_event_released",
        enabled: false,
        matches(event) {
            return event.eventType === "economic_calendar" &&
                event.status === "released";
        },
        createTaskRequest() {
            return null;
        }
    }),
    Object.freeze({
        ruleId: "scheduled_event_requires_task",
        enabled: false,
        matches(event) {
            return event.eventType === "scheduled" &&
                event.status === "released";
        },
        createTaskRequest() {
            return null;
        }
    })
]);

function getMatchingRules(event, rules = EVENT_RULES) {
    return rules.filter(rule => rule.enabled && rule.matches(event));
}

function createEventScope(event) {
    return {
        eventType: event.eventType,
        category: event.category,
        event: event.title,
        source: event.source.provider,
        impact: event.impact,
        currency: event.currency
    };
}

function createFounderNotification(event) {
    return {
        type: "founder_notification",
        action: "founder.notify",
        eventReference: event.eventId,
        message: `${event.title} is approaching.`,
        createdAt: event.statusChangedAt
    };
}

module.exports = {
    EVENT_RULES,
    getMatchingRules
};
