const {
    EVENT_STATUSES,
    createEvent,
    validateEvent,
    transitionEvent
} = require("./02_eventContracts");

const {
    EVENT_RULES,
    getMatchingRules
} = require("./04_eventRules");

const RuleResolver = require("../Rule_Layer/03_ruleResolver");
const { RULE_MODES } = require("../Rule_Layer/01_ruleContracts");

class EventEngine {
    constructor(options = {}) {
        this.clock = options.clock || (() => new Date());
        this.eventIdGenerator = options.eventIdGenerator;
        this.approachWindowMs = options.approachWindowMs || 5 * 60 * 1000;
        this.rules = options.rules || EVENT_RULES;
        this.taskEngine = options.taskEngine || null;
        this.ruleResolver = options.ruleResolver || new RuleResolver();
        this.events = new Map();
        this.eventsByDeduplicationKey = new Map();
    }

    async ingest(candidate) {
        const existingId = this.eventsByDeduplicationKey.get(
            candidate.deduplicationKey
        );

        if (existingId) {
            const event = this.events.get(existingId);
            this.reconcile(event, candidate);
            await this.evaluateRules(event);
            return { event, taskExecutions: [] };
        }

        const event = createEvent(candidate, {
            clock: this.clock,
            idGenerator: this.eventIdGenerator
        });
        this.events.set(event.eventId, event);
        this.eventsByDeduplicationKey.set(
            event.deduplicationKey,
            event.eventId
        );

        transitionEvent(
            event,
            EVENT_STATUSES.NORMALIZED,
            "Event normalized by source adapter",
            this.clock
        );

        const validation = validateEvent(event);
        event.validationErrors = validation.errors;

        if (!validation.valid) {
            event.dataStatus = "invalid";
            transitionEvent(
                event,
                EVENT_STATUSES.INVALID,
                "Event validation failed",
                this.clock
            );
            return { event, taskExecutions: [] };
        }

        event.dataStatus = "verified";
        transitionEvent(
            event,
            EVENT_STATUSES.VALIDATED,
            "Event validation passed",
            this.clock
        );
        transitionEvent(
            event,
            event.release && event.release.isReleased
                ? EVENT_STATUSES.RELEASED
                : EVENT_STATUSES.UPCOMING,
            "Initial Event lifecycle state assigned",
            this.clock
        );

        const taskExecutions = await this.evaluateRules(event);
        return { event, taskExecutions };
    }

    async evaluate(eventId, now = this.clock()) {
        const event = this.events.get(eventId);

        if (!event) {
            throw new Error(`Event ${eventId} was not found`);
        }

        if (event.status === EVENT_STATUSES.UPCOMING) {
            const scheduledAt = Date.parse(event.scheduledAt);
            const millisecondsUntilEvent = scheduledAt - now.getTime();

            if (millisecondsUntilEvent <= this.approachWindowMs) {
                transitionEvent(
                    event,
                    EVENT_STATUSES.APPROACHING,
                    "Event entered configured approach window",
                    this.clock
                );
            }
        }

        const taskExecutions = await this.evaluateRules(event);
        return { event, taskExecutions };
    }

    async evaluateRules(event) {
        const taskExecutions = [];
        const rules = getMatchingRules(event, this.rules);

        for (const rule of rules) {
            const triggerKey = `${rule.ruleId}:${event.revision}:${event.status}`;

            if (event.triggeredRules.some(item => item.triggerKey === triggerKey)) {
                continue;
            }

            const action = rule.action;
            const scope = rule.createScope(event);
            const decision = this.ruleResolver.resolve(action, scope);
            const trigger = {
                ruleId: rule.ruleId,
                triggerKey,
                at: this.clock().toISOString(),
                taskReference: null,
                founderRuleId: decision.rule ? decision.rule.id : null,
                effectiveMode: decision.mode
            };

            event.triggeredRules.push(trigger);

            if (decision.mode === RULE_MODES.DISABLED) {
                taskExecutions.push({
                    taskRequest: null,
                    execution: null,
                    notificationAction: null,
                    decision
                });
                continue;
            }

            if (decision.mode === RULE_MODES.NOTIFICATION_ONLY) {
                taskExecutions.push({
                    taskRequest: null,
                    execution: null,
                    notificationAction: rule.createNotificationAction(event),
                    decision
                });
                continue;
            }

            if (decision.mode === RULE_MODES.AUTOMATIC &&
                !rule.capabilityPolicy.automaticAllowed) {
                taskExecutions.push({
                    taskRequest: null,
                    execution: null,
                    notificationAction: null,
                    decision: {
                        ...decision,
                        blockedByPolicy: true,
                        reason: "Capability policy does not allow automatic Task creation."
                    }
                });
                continue;
            }

            const taskRequest = rule.createTaskRequest(event);
            applyApprovalDecision(taskRequest, decision);

            if (!taskRequest || !this.taskEngine ||
                typeof this.taskEngine.execute !== "function") {
                taskExecutions.push({
                    taskRequest,
                    execution: null,
                    notificationAction: null,
                    decision
                });
                continue;
            }

            const execution = await this.taskEngine.execute(taskRequest);
            trigger.taskReference = execution.task.taskId;
            event.taskReferences.push(execution.task.taskId);
            taskExecutions.push({
                taskRequest,
                execution,
                notificationAction: null,
                decision
            });
        }

        return taskExecutions;
    }

    reconcile(event, candidate) {
        event.revision += 1;
        event.title = candidate.title || event.title;
        event.category = candidate.category || event.category;
        event.country = candidate.country || event.country;
        event.currency = candidate.currency || event.currency;
        event.impact = candidate.impact || event.impact;
        event.scheduledAt = candidate.scheduledAt || event.scheduledAt;
        event.release = candidate.release || event.release;
        event.releaseObservedAt = candidate.releaseObservedAt || event.releaseObservedAt;
        event.metadata = { ...event.metadata, ...(candidate.metadata || {}) };

        if (candidate.cancelled === true) {
            transitionEvent(event, EVENT_STATUSES.CANCELLED, "Source confirmed cancellation", this.clock);
            return;
        }

        if (event.release && event.release.isReleased &&
            event.status !== EVENT_STATUSES.RELEASED) {
            transitionEvent(event, EVENT_STATUSES.RELEASED, "Source confirmed release data", this.clock);
        }
    }
}

function applyApprovalDecision(taskRequest, decision) {
    if (!taskRequest) {
        return;
    }

    if (decision.mode === RULE_MODES.AUTOMATIC) {
        taskRequest.approval = {
            required: false,
            status: "not_required",
            reason: decision.rule
                ? `Founder Rule ${decision.rule.id} allows automatic Task creation.`
                : "Effective Rule decision allows automatic Task creation."
        };
        return;
    }

    taskRequest.approval = {
        required: true,
        status: "pending",
        reason: decision.rule
            ? `Founder Rule ${decision.rule.id} requires approval.`
            : "External event publication requires explicit founder approval."
    };
}

module.exports = EventEngine;
