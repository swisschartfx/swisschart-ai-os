const assert = require("assert");

const SwisschartAssistant = require("../Assistant/01_assistant");
const AutomationManager = require("../Automation_Manager/automationManager");
const AutomationSchedulerBridge = require("./automationSchedulerBridge");
const SchedulerRuntime = require("./schedulerRuntime");
const { createScheduledTaskRule } = require("./scheduledEventHandler");
const EventEngine = require("../Event_Engine/03_eventEngine");
const TaskEngine = require("../Task_Engine/02_taskEngine");
const ScheduledTaskEngineAdapter = require("../Task_Engine/06_scheduledTaskEngineAdapter");
const FounderCommandParser = require("../Assistant/founderCommandParser");

async function run() {
    let now = new Date("2026-08-12T05:01:00.000Z");
    const automationManager = new AutomationManager();
    const assistant = new SwisschartAssistant({
        taskEngine: {},
        ruleResolver: {},
        automationManager,
        notionAgent: { handleRequest() {} },
        telegramPublishingWorkflow: { execute() {} }
    });

    await assistant.handle({
        type: "automation",
        action: "create",
        automation: createOneTimeAutomation("one-time-automation", true)
    });
    await assistant.handle({
        type: "automation",
        action: "create",
        automation: createDailyAutomation("disabled-automation", false)
    });

    const parser = new FounderCommandParser({
        automationIdGenerator: () => "parsed-daily-automation"
    });
    await assistant.handle(
        parser.parse("create daily generic automation at 08:00")
    );

    const bridge = new AutomationSchedulerBridge({
        automationManager,
        clock: () => now
    });
    const scheduledEvents = bridge.getScheduledEvents();
    assert.strictEqual(scheduledEvents.length, 2);
    const oneTime = scheduledEvents.find(event =>
        event.name === "one-time-automation"
    );
    assert.strictEqual(oneTime.executeAt, "2026-08-12T05:00:00.000Z");
    const daily = scheduledEvents.find(event =>
        event.name === "parsed-daily-automation"
    );
    assert.strictEqual(daily.executeAt, "2026-08-12T05:00:00.000Z");
    assert.strictEqual(
        daily.metadata.scheduleReference,
        "parsed-daily-automation:2026-08-12T05:00:00.000Z"
    );

    const taskEngine = new TaskEngine({
        clock: () => now,
        taskIdGenerator: () => `automation-task-${Date.now()}`,
        resultIdGenerator: () => `automation-result-${Date.now()}`,
        executors: {}
    });
    const taskAdapter = new ScheduledTaskEngineAdapter({ taskEngine });
    const eventEngine = new EventEngine({
        clock: () => now,
        eventIdGenerator: (() => {
            let id = 0;
            return () => `automation-event-${++id}`;
        })(),
        taskEngine: taskAdapter,
        rules: [createScheduledTaskRule()]
    });
    const runtime = new SchedulerRuntime({
        eventEngine,
        clock: () => now,
        getScheduledEvents: () => bridge.getScheduledEvents()
    });

    const results = await runtime.tick();
    assert.strictEqual(results.length, 2);
    const execution = results[0].taskExecutions[0].execution;
    assert.strictEqual(execution.task.source, "event");
    assert.strictEqual(execution.task.input.configuredValue, "arbitrary");
    assert.strictEqual(execution.task.status, "blocked");
    assert.strictEqual(execution.task.terminalReason, "AWAITING_FOUNDER_APPROVAL");
    assert.strictEqual(execution.task.attempts.length, 0);

    const duplicate = await runtime.tick();
    assert.deepStrictEqual(duplicate, []);

    now = new Date("2026-08-13T05:01:00.000Z");
    const nextDay = await runtime.tick();
    assert.strictEqual(nextDay.length, 1);
    assert.strictEqual(
        nextDay[0].event.metadata.scheduleReference,
        "parsed-daily-automation:2026-08-13T05:00:00.000Z"
    );

    assert.strictEqual(bridge.service, undefined);
    assert.strictEqual(runtime.service, undefined);
    console.log("Automation Scheduler Bridge integration test passed");
}

function createOneTimeAutomation(automationId, enabled) {
    return {
        automationId,
        name: `Automation ${automationId}`,
        enabled,
        trigger: {
            type: "schedule",
            executeAt: "2026-08-12T05:00:00.000Z",
            timezone: "Europe/Istanbul"
        },
        action: {
            intent: "generic.execute",
            objective: "Execute configured automation action.",
            capabilityRequirement: "generic.execute",
            input: { configuredValue: "arbitrary" }
        },
        approvalPolicy: { required: true },
        metadata: { createdBy: "founder" }
    };
}

function createDailyAutomation(automationId, enabled) {
    const automation = createOneTimeAutomation(automationId, enabled);
    automation.trigger = {
        type: "schedule",
        frequency: "daily",
        time: "08:00",
        timezone: "Europe/Istanbul"
    };
    return automation;
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
