const SchedulerEventAdapter = require("../Event_Engine/06_schedulerEventAdapter");
const ScheduledEventHandler = require("./scheduledEventHandler");

class SchedulerRuntime {
    constructor(options = {}) {
        if (!options.eventEngine || typeof options.eventEngine.ingest !== "function" ||
            typeof options.eventEngine.evaluate !== "function") {
            throw new Error("Scheduler runtime requires an Event Engine");
        }

        this.eventEngine = options.eventEngine;
        this.scheduler = options.scheduler || null;
        this.automationSchedulerBridge =
            options.automationSchedulerBridge || null;
        this.getScheduledEvents = options.getScheduledEvents || (() => {
            if (this.automationSchedulerBridge &&
                typeof this.automationSchedulerBridge.getScheduledEvents ===
                    "function") {
                return this.automationSchedulerBridge.getScheduledEvents();
            }

            return this.scheduler &&
                typeof this.scheduler.getJobs === "function"
                ? this.scheduler.getJobs()
                : [];
        });
        this.eventAdapter = options.eventAdapter || new SchedulerEventAdapter();
        this.eventHandler = options.eventHandler || new ScheduledEventHandler({
            eventEngine: this.eventEngine
        });
        this.intervalMs = options.intervalMs || 1000;
        this.clock = options.clock || (() => new Date());
        this.setInterval = options.setInterval || setInterval;
        this.clearInterval = options.clearInterval || clearInterval;
        this.processedOccurrences = new Set();
        this.occurrenceStore = options.occurrenceStore || null;
        this.timer = null;
        this.tickPromise = null;
    }

    start() {
        if (this.timer) {
            return false;
        }

        if (this.occurrenceStore &&
            typeof this.occurrenceStore.recoverClaimedBeforePublishing === "function") {
            if (typeof this.occurrenceStore.recoverInterruptedPublishing === "function") {
                this.occurrenceStore.recoverInterruptedPublishing(this.clock().toISOString());
            }
            this.occurrenceStore.recoverClaimedBeforePublishing(this.clock().toISOString());
        }
        this.timer = this.setInterval(() => {
            this.tick().catch(error => {
                console.error("Scheduler runtime tick failed", error);
            });
        }, this.intervalMs);

        return true;
    }

    stop() {
        if (!this.timer) {
            return false;
        }

        this.clearInterval(this.timer);
        this.timer = null;
        return true;
    }

    async tick() {
        if (this.tickPromise) {
            return this.tickPromise;
        }

        this.tickPromise = this.evaluateDueEvents();

        try {
            return await this.tickPromise;
        } finally {
            this.tickPromise = null;
        }
    }

    async evaluateDueEvents() {
        const now = this.clock();
        const scheduledEvents = await this.getScheduledEvents();
        const results = [];

        for (const scheduledEvent of scheduledEvents) {
            const executeAt = scheduledEvent.executeAt instanceof Date
                ? scheduledEvent.executeAt
                : new Date(scheduledEvent.executeAt);
            const occurrenceKey = `${scheduledEvent.name}:${executeAt.toISOString()}`;

            if (executeAt.getTime() > now.getTime() ||
                this.processedOccurrences.has(occurrenceKey)) {
                continue;
            }

            let durableClaim = null;
            if (this.occurrenceStore && scheduledEvent.metadata &&
                scheduledEvent.metadata.occurrenceKey) {
                durableClaim = this.occurrenceStore.claimOccurrence(
                    scheduledEvent.metadata.occurrenceKey, now.toISOString());
                if (!durableClaim.claimed) continue;
            }
            try {
                const evaluated = await this.eventHandler.handle(
                    this.eventAdapter.adapt(scheduledEvent), now);
                if (durableClaim) {
                    const current = this.occurrenceStore.getOccurrence(
                        scheduledEvent.metadata.occurrenceKey);
                    if (current && current.state === "claimed") {
                        this.occurrenceStore.transitionOccurrence(
                            current.occurrenceKey, "held", {
                                detail: { code: "SCHEDULE_EXECUTION_NOT_FINALIZED" }
                            }, now.toISOString());
                    }
                }
                this.processedOccurrences.add(occurrenceKey);
                results.push(evaluated);
            } catch (error) {
                if (durableClaim) {
                    const current = this.occurrenceStore.getOccurrence(
                        scheduledEvent.metadata.occurrenceKey);
                    if (current && current.state === "claimed") {
                        this.occurrenceStore.transitionOccurrence(current.occurrenceKey,
                            "failed_safe_to_retry", { detail: { code: error.code ||
                                "SCHEDULE_EXECUTION_FAILED_BEFORE_PUBLISH" } }, now.toISOString());
                    }
                }
                results.push({ error: { code: error.code || "SCHEDULE_RUNTIME_FAILED" },
                    occurrenceKey: scheduledEvent.metadata &&
                        scheduledEvent.metadata.occurrenceKey });
            }
        }

        return results;
    }

    isRunning() {
        return this.timer !== null;
    }
}

module.exports = SchedulerRuntime;
