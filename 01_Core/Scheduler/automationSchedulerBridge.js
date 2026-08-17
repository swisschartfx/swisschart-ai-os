class AutomationSchedulerBridge {
    constructor(options = {}) {
        if (!options.automationManager ||
            typeof options.automationManager.getAutomations !== "function") {
            throw new Error("Automation Scheduler Bridge requires Automation Manager");
        }

        this.automationManager = options.automationManager;
        this.clock = options.clock || (() => new Date());
        this.occurrenceStore = options.occurrenceStore || null;
        this.occurrenceResolver = options.occurrenceResolver || null;
        this.suppressionPolicy = options.suppressionPolicy || { evaluate() {
            return { suppressed: false, reason: null, reference: null };
        } };
        this.lookbackMs = options.lookbackMs === undefined ? 5 * 60 * 1000
            : options.lookbackMs;
    }

    getScheduledEvents() {
        const now = this.clock();

        if (typeof this.automationManager.listSchedules === "function" &&
            this.occurrenceStore && this.occurrenceResolver) {
            return this.getDurableScheduleEvents(now);
        }

        return this.automationManager.getAutomations({ enabled: true })
            .filter(automation =>
                automation.trigger &&
                automation.trigger.type === "schedule"
            )
            .map(automation => toScheduledEvent(automation, now));
    }

    getDurableScheduleEvents(now) {
        const { Temporal } = require("@js-temporal/polyfill");
        const nowInstant = Temporal.Instant.from(now.toISOString());
        const scheduled = [];
        for (const schedule of this.automationManager.listSchedules({ enabled: true })) {
            if (schedule.tombstoned || !schedule.approval ||
                schedule.approval.status !== "approved") continue;
            const localToday = nowInstant.toZonedDateTimeISO(schedule.trigger.timezone)
                .toPlainDate();
            for (const delta of [-1, 0, 1]) {
                const occurrence = this.occurrenceResolver.resolve(schedule,
                    localToday.add({ days: delta }).toString());
                if (!occurrence) continue;
                const occurrenceMs = Date.parse(occurrence.resolvedInstant);
                if (occurrenceMs < now.getTime() - this.lookbackMs ||
                    occurrenceMs > now.getTime() + 24 * 60 * 60 * 1000) continue;
                const suppression = this.suppressionPolicy.evaluate({ schedule,
                    occurrence });
                const stored = this.occurrenceStore.planOccurrence(occurrence,
                    schedule, now.toISOString());
                if (suppression && suppression.suppressed) {
                    if (stored.state === "planned") this.occurrenceStore
                        .transitionOccurrence(stored.occurrenceKey, "suppressed",
                            { detail: suppression }, now.toISOString());
                    continue;
                }
                const grace = schedule.executionPolicy.misfireGraceSeconds;
                const lateness = now.getTime() - occurrenceMs;
                if (lateness > 0 && (grace === null || lateness > grace * 1000)) {
                    if (stored.state === "planned") this.occurrenceStore
                        .transitionOccurrence(stored.occurrenceKey, "skipped",
                            { detail: { code: "SCHEDULE_MISFIRE_SKIPPED", latenessMs: lateness } },
                            now.toISOString());
                    continue;
                }
                const latest = this.occurrenceStore.getOccurrence(stored.occurrenceKey);
                if (latest.state !== "planned" && latest.state !== "failed_safe_to_retry") continue;
                scheduled.push(toDurableScheduledEvent(schedule, occurrence));
            }
        }
        return scheduled.sort((a, b) => Date.parse(a.executeAt) - Date.parse(b.executeAt) ||
            a.metadata.priority - b.metadata.priority || a.name.localeCompare(b.name));
    }
}

function toDurableScheduledEvent(schedule, occurrence) {
    return {
        name: schedule.scheduleId,
        executeAt: occurrence.resolvedInstant,
        timezone: schedule.trigger.timezone,
        category: "scheduled_channel_message",
        reference: occurrence.identity,
        occurrenceKey: occurrence.occurrenceKey,
        metadata: {
            occurrenceKey: occurrence.occurrenceKey,
            occurrenceIdentity: occurrence.identity,
            priority: schedule.priority,
            taskPayload: {
                intent: "content.publish",
                objective: "Publish the approved recurring Telegram schedule occurrence.",
                capabilityRequirement: "publishing.publish",
                input: { message: schedule.publication.template.content,
                    destination: schedule.publication.destination, contentType: "text" },
                priority: "normal"
            },
            publicationRender: {
                rendererVersion: schedule.publication.rendererVersion,
                templateId: schedule.publication.template.templateId,
                templateRevision: schedule.publication.template.revision,
                displayTimezone: schedule.publication.displayTimezone,
                baseContent: schedule.publication.template.content
            },
            approvedScheduleGrant: {
                approvalBasis: "approved_schedule_revision",
                scheduleId: schedule.scheduleId,
                revision: schedule.revision,
                approvalHash: schedule.approval.approvedPayloadHash,
                occurrenceKey: occurrence.occurrenceKey,
                occurrenceIdentity: occurrence.identity,
                destination: schedule.publication.destination,
                capabilityRequirement: "publishing.publish",
                templateRevision: schedule.publication.template.revision,
                rendererVersion: schedule.publication.rendererVersion,
                suppressed: false
            }
        }
    };
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
