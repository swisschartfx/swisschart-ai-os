const assert = require("assert");

const SchedulerRuntime = require("./schedulerRuntime");
const { createScheduledTaskRule } = require("./scheduledEventHandler");
const EventEngine = require("../Event_Engine/03_eventEngine");
const TaskEngine = require("../Task_Engine/02_taskEngine");
const ScheduledTaskEngineAdapter = require("../Task_Engine/06_scheduledTaskEngineAdapter");

async function run() {
    const now = new Date("2026-08-12T10:01:00.000Z");
    const taskEngine = new TaskEngine({
        clock: () => now,
        taskIdGenerator: () => "task-scheduled-1",
        resultIdGenerator: () => "result-scheduled-1",
        executors: {}
    });
    const taskEngineAdapter = new ScheduledTaskEngineAdapter({ taskEngine });
    const eventEngine = new EventEngine({
        clock: () => now,
        eventIdGenerator: () => "event-scheduled-1",
        taskEngine: taskEngineAdapter,
        rules: [createScheduledTaskRule()]
    });
    const scheduledEvent = {
        name: "publish-market-update",
        category: "publishing",
        executeAt: new Date("2026-08-12T10:00:00.000Z"),
        timezone: "UTC",
        metadata: {
            taskPayload: {
                intent: "content.publish",
                objective: "Publish the scheduled market update.",
                capabilityRequirement: "publishing.publish",
                input: {
                    message: "Scheduled market update",
                    destination: "telegram.primary",
                    contentType: "text"
                }
            }
        }
    };
    const runtime = new SchedulerRuntime({
        eventEngine,
        clock: () => now,
        getScheduledEvents: () => [scheduledEvent]
    });

    const firstTick = await runtime.tick();
    assert.strictEqual(firstTick.length, 1);
    assert.strictEqual(firstTick[0].taskExecutions.length, 1);

    const execution = firstTick[0].taskExecutions[0].execution;
    assert.ok(execution);
    assert.strictEqual(
        firstTick[0].taskExecutions[0].decision.mode,
        "APPROVAL_REQUIRED"
    );
    assert.strictEqual(execution.task.taskId, "task-scheduled-1");
    assert.strictEqual(execution.task.input.message, "Scheduled market update");
    assert.strictEqual(execution.task.status, "blocked");
    assert.strictEqual(execution.task.terminalReason, "AWAITING_FOUNDER_APPROVAL");
    assert.strictEqual(execution.task.attempts.length, 0);
    assert.strictEqual(taskEngineAdapter.executions.size, 1);

    const duplicateTick = await runtime.tick();
    assert.deepStrictEqual(duplicateTick, []);
    assert.strictEqual(taskEngineAdapter.executions.size, 1);

    console.log("Scheduler Task execution integration test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
