class AutomationSchedulerBridge {
    constructor(options = {}) {
        if (!options.automationManager ||
            typeof options.automationManager.getAutomations !== "function") {
            throw new Error("Automation Scheduler Bridge requires Automation Manager");
        }

        this.automationManager = options.automationManager;
        this.clock = options.clock || (() => new Date());
    }

    getScheduledEvents() {
        const now = this.clock();

        return this.automationManager.getAutomations({ enabled: true })
            .filter(automation =>
                automation.trigger &&
                automation.trigger.type === "schedule"
            )
            .map(automation => toScheduledEvent(automation, now));
    }
}

function toScheduledEvent(automation, now) {
    const occurrence = resolveOccurrence(automation.trigger, now);
    const scheduleReference =
        `${automation.automationId}:${occurrence.toISOString()}`;
    const taskPayload = automation.workflow
        ? {
            intent: "execute_workflow",
            objective: "Execute the configured scheduled automation workflow.",
            capabilityRequirement: "automation_workflow",
            input: { automationId: automation.automationId },
            priority: "normal"
        }
        : {
            intent: automation.action.intent,
            objective: automation.action.objective ||
                "Execute the configured scheduled automation.",
            capabilityRequirement: automation.action.capabilityRequirement,
            input: automation.action.input || {},
            priority: automation.action.priority || "normal"
        };

    return {
        name: automation.automationId,
        executeAt: occurrence.toISOString(),
        timezone: automation.trigger.timezone || "UTC",
        category: "automation",
        reference: scheduleReference,
        metadata: {
            automationId: automation.automationId,
            scheduleReference,
            automationMetadata: automation.metadata || {},
            approvalPolicy: automation.approvalPolicy,
            taskPayload
        }
    };
}

function resolveOccurrence(trigger, now) {
    if (trigger.executeAt) {
        const executeAt = new Date(trigger.executeAt);

        if (Number.isNaN(executeAt.getTime())) {
            throw new Error("Schedule trigger executeAt must be a valid ISO datetime");
        }

        return executeAt;
    }

    if (trigger.frequency !== "daily" ||
        !/^([01]\d|2[0-3]):([0-5]\d)$/.test(trigger.time || "")) {
        throw new Error("Schedule trigger requires executeAt or daily HH:MM time");
    }

    const timezone = trigger.timezone || "UTC";
    const localNow = getZonedParts(now, timezone);
    const [hour, minute] = trigger.time.split(":").map(Number);
    const occurrence = zonedDateTimeToUtc({
        year: localNow.year,
        month: localNow.month,
        day: localNow.day,
        hour,
        minute,
        second: 0
    }, timezone);

    return occurrence;
}

function getZonedParts(date, timezone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);

    return Object.fromEntries(parts
        .filter(part => part.type !== "literal")
        .map(part => [part.type, Number(part.value)]));
}

function zonedDateTimeToUtc(local, timezone) {
    const desiredAsUtc = Date.UTC(
        local.year,
        local.month - 1,
        local.day,
        local.hour,
        local.minute,
        local.second
    );
    let candidate = new Date(desiredAsUtc);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const actual = getZonedParts(candidate, timezone);
        const actualAsUtc = Date.UTC(
            actual.year,
            actual.month - 1,
            actual.day,
            actual.hour,
            actual.minute,
            actual.second
        );
        candidate = new Date(candidate.getTime() + desiredAsUtc - actualAsUtc);
    }

    return candidate;
}

module.exports = AutomationSchedulerBridge;
module.exports.resolveOccurrence = resolveOccurrence;
