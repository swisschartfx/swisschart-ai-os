const assert = require("assert");

const EventEngine = require("./03_eventEngine");
const ForexFactoryEventAdapter = require("./05_forexFactoryEventAdapter");
const SchedulerEventAdapter = require("./06_schedulerEventAdapter");
const RuleStore = require("../Rule_Layer/02_ruleStore");
const RuleResolver = require("../Rule_Layer/03_ruleResolver");
const {
    RULE_MODES,
    RULE_STATUSES
} = require("../Rule_Layer/01_ruleContracts");

function createClock(initialTime) {
    let time = new Date(initialTime).getTime();

    return {
        now: () => new Date(time),
        advance(milliseconds) {
            time += milliseconds;
        }
    };
}

function createMockTaskEngine() {
    const calls = [];

    return {
        calls,
        async execute(taskRequest) {
            calls.push(taskRequest);

            return {
                task: {
                    taskId: `task-${calls.length}`,
                    status: "awaiting_approval"
                },
                result: null
            };
        }
    };
}

function createFounderRule(overrides) {
    return {
        id: overrides.id,
        name: overrides.name,
        scope: overrides.scope,
        action: overrides.action,
        mode: overrides.mode,
        priority: overrides.priority,
        status: RULE_STATUSES.ACTIVE,
        createdBy: "founder",
        createdAt: "2026-08-12T09:00:00.000Z",
        updatedAt: "2026-08-12T09:00:00.000Z",
        ...overrides
    };
}

async function run() {
    const clock = createClock("2026-08-12T10:00:00.000Z");
    const taskEngine = createMockTaskEngine();
    const eventEngine = new EventEngine({
        clock: clock.now,
        eventIdGenerator: () => "event-1",
        taskEngine
    });
    const forexFactory = new ForexFactoryEventAdapter();

    const candidate = forexFactory.adapt({
        id: "ff-cpi-usd",
        title: "CPI m/m",
        currency: "USD",
        impact: "High",
        scheduledAt: "2026-08-12T10:05:00.000Z",
        forecast: "0.2%"
    }, {
        retrievedAt: "2026-08-12T10:00:00.000Z"
    });

    assert.strictEqual(candidate.source.provider, "forex_factory");
    assert.strictEqual(candidate.impact, "high");

    const ingested = await eventEngine.ingest(candidate);
    assert.strictEqual(ingested.event.status, "upcoming");
    assert.strictEqual(taskEngine.calls.length, 0);

    clock.advance(60 * 1000);
    const approaching = await eventEngine.evaluate("event-1", clock.now());
    assert.strictEqual(approaching.event.status, "approaching");
    assert.strictEqual(taskEngine.calls.length, 1);
    assert.strictEqual(taskEngine.calls[0].source, "event");
    assert.strictEqual(taskEngine.calls[0].approval.status, "pending");
    assert.strictEqual(taskEngine.calls[0].capabilityRequirement, "publishing.publish");
    assert.strictEqual(approaching.taskExecutions[0].decision.mode, RULE_MODES.APPROVAL_REQUIRED);
    assert.strictEqual(approaching.taskExecutions[0].decision.source, "default");

    await eventEngine.evaluate("event-1", clock.now());
    assert.strictEqual(taskEngine.calls.length, 1);

    const releasedCandidate = forexFactory.adapt({
        id: "ff-cpi-usd",
        title: "CPI m/m",
        currency: "USD",
        impact: "High",
        scheduledAt: "2026-08-12T10:05:00.000Z",
        actual: "0.3%",
        released: true
    });
    const reconciled = await eventEngine.ingest(releasedCandidate);
    assert.strictEqual(reconciled.event.eventId, "event-1");
    assert.strictEqual(reconciled.event.revision, 2);
    assert.strictEqual(reconciled.event.status, "released");
    assert.strictEqual(taskEngine.calls.length, 1);

    const invalid = await eventEngine.ingest({
        eventType: "economic_calendar",
        deduplicationKey: "invalid-event",
        source: {
            provider: "mock",
            adapterId: "mock-adapter"
        },
        title: "Invalid event"
    });
    assert.strictEqual(invalid.event.status, "invalid");

    const scheduler = new SchedulerEventAdapter();
    const scheduledEvent = scheduler.adapt({
        name: "evaluate-economic-events",
        executeAt: "2026-08-12T10:10:00.000Z",
        timezone: "UTC"
    });
    assert.strictEqual(scheduledEvent.eventType, "scheduled");
    assert.strictEqual(scheduledEvent.source.provider, "scheduler");

    const founderRuleStore = new RuleStore();
    founderRuleStore.addRule(createFounderRule({
        id: "rule-economic-news-approval",
        name: "Economic news publishing approval",
        scope: { eventType: "economic_calendar" },
        action: "publishing.external",
        mode: RULE_MODES.APPROVAL_REQUIRED,
        priority: 100
    }));
    founderRuleStore.addRule(createFounderRule({
        id: "rule-london-open-automatic",
        name: "London Open notification",
        scope: {
            eventType: "scheduled",
            category: "market_session",
            event: "london_open"
        },
        action: "founder.notify",
        mode: RULE_MODES.AUTOMATIC,
        priority: 200
    }));

    const ruledTaskEngine = createMockTaskEngine();
    let ruledEventId = 0;
    const ruledEventEngine = new EventEngine({
        clock: clock.now,
        eventIdGenerator: () => `ruled-event-${++ruledEventId}`,
        taskEngine: ruledTaskEngine,
        ruleResolver: new RuleResolver({ ruleStore: founderRuleStore })
    });

    const ruledEconomicEvent = forexFactory.adapt({
        id: "ff-nfp-usd",
        title: "Non-Farm Employment Change",
        currency: "USD",
        impact: "High",
        scheduledAt: "2026-08-12T10:05:00.000Z"
    });
    const ruledEconomicIngest = await ruledEventEngine.ingest(ruledEconomicEvent);
    const ruledEconomicResult = await ruledEventEngine.evaluate(
        ruledEconomicIngest.event.eventId,
        clock.now()
    );
    const economicDecision = ruledEconomicResult.taskExecutions[0].decision;
    assert.strictEqual(economicDecision.mode, RULE_MODES.APPROVAL_REQUIRED);
    assert.strictEqual(economicDecision.rule.id, "rule-economic-news-approval");
    assert.strictEqual(ruledTaskEngine.calls[0].approval.status, "pending");

    const londonOpenEvent = scheduler.adapt({
        name: "london_open",
        category: "market_session",
        executeAt: "2026-08-12T10:05:00.000Z",
        timezone: "UTC"
    });
    const londonOpenIngest = await ruledEventEngine.ingest(londonOpenEvent);
    const londonOpenResult = await ruledEventEngine.evaluate(
        londonOpenIngest.event.eventId,
        clock.now()
    );
    assert.strictEqual(londonOpenResult.taskExecutions.length, 1);
    assert.strictEqual(
        londonOpenResult.taskExecutions[0].decision.mode,
        RULE_MODES.AUTOMATIC
    );
    assert.strictEqual(ruledTaskEngine.calls[1].approval.status, "not_required");

    const notificationOnlyStore = new RuleStore();
    notificationOnlyStore.addRule(createFounderRule({
        id: "rule-economic-news-notification-only",
        name: "Economic news founder notification only",
        scope: { eventType: "economic_calendar" },
        action: "publishing.external",
        mode: RULE_MODES.NOTIFICATION_ONLY,
        priority: 100
    }));
    const notificationTaskEngine = createMockTaskEngine();
    const notificationEventEngine = new EventEngine({
        clock: clock.now,
        eventIdGenerator: () => "notification-event-1",
        taskEngine: notificationTaskEngine,
        ruleResolver: new RuleResolver({ ruleStore: notificationOnlyStore })
    });
    const notificationIngest = await notificationEventEngine.ingest(
        forexFactory.adapt({
            id: "ff-notification-only",
            title: "Interest Rate Decision",
            currency: "USD",
            impact: "High",
            scheduledAt: "2026-08-12T10:05:00.000Z"
        })
    );
    const notificationResult = await notificationEventEngine.evaluate(
        notificationIngest.event.eventId,
        clock.now()
    );
    assert.strictEqual(notificationTaskEngine.calls.length, 0);
    assert.strictEqual(
        notificationResult.taskExecutions[0].notificationAction.type,
        "founder_notification"
    );

    console.log("Event Engine mock tests passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
