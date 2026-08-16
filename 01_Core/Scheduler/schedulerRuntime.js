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
        this.timer = null;
        this.tickPromise = null;
    }

    start() {
        if (this.timer) {
            return false;
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

            const evaluated = await this.eventHandler.handle(
                this.eventAdapter.adapt(scheduledEvent),
                now
            );

            this.processedOccurrences.add(occurrenceKey);
            results.push(evaluated);
        }

        return results;
    }

    isRunning() {
        return this.timer !== null;
    }
}

module.exports = SchedulerRuntime;
