const assert = require("assert");

const runtime = require("./bootstrap");
const AutomationManager = require("./Automation_Manager/automationManager");

async function run() {
    const creationTime = new Date("2026-08-12T12:00:00.000Z");
    const executionTime = new Date("2026-08-13T05:01:00.000Z");
    const isolatedAutomationManager = new AutomationManager({
        automationStore: null
    });

    runtime.assistant.automationManager = isolatedAutomationManager;
    runtime.assistant.automationSchedulerBridge.automationManager =
        isolatedAutomationManager;
    runtime.assistant.founderCommandParser.clock = () => creationTime;
    runtime.assistant.automationSchedulerBridge.clock = () => executionTime;
    runtime.schedulerRuntime.clock = () => executionTime;
    runtime.eventEngine.clock = () => executionTime;

    const automation = await runtime.assistant.handle(
        "schedule telegram message Swisschart morning update tomorrow at 8 AM"
    );

    assert.ok(automation.automationId);
    assert.deepStrictEqual(
        runtime.assistant.automationManager.getAutomation(
            automation.automationId
        ),
        automation
    );

    const scheduledEvents =
        runtime.assistant.automationSchedulerBridge.getScheduledEvents();
    const scheduledEvent = scheduledEvents.find(event =>
        event.name === automation.automationId
    );

    assert.ok(scheduledEvent);
    assert.strictEqual(
        scheduledEvent.metadata.taskPayload.capabilityRequirement,
        "publishing.publish"
    );

    const evaluations = await runtime.schedulerRuntime.tick();

    assert.strictEqual(evaluations.length, 1);
    assert.strictEqual(evaluations[0].event.eventType, "scheduled");
    assert.strictEqual(evaluations[0].taskExecutions.length, 1);

    const taskExecution = evaluations[0].taskExecutions[0];
    assert.strictEqual(
        taskExecution.taskRequest.capabilityRequirement,
        "publishing.publish"
    );
    assert.strictEqual(taskExecution.taskRequest.intent, "content.publish");
    assert.deepStrictEqual(taskExecution.taskRequest.approval, {
        required: true,
        status: "pending",
        reason: "External event publication requires explicit founder approval."
    });
    assert.strictEqual(taskExecution.execution.task.approval.status, "pending");
    assert.strictEqual(taskExecution.execution.task.status, "blocked");
    assert.strictEqual(
        taskExecution.execution.task.terminalReason,
        "AWAITING_FOUNDER_APPROVAL"
    );
    assert.strictEqual(
        runtime.schedulerRuntime.isRunning(),
        false
    );

    console.log("Bootstrap Scheduler runtime integration test passed");
}

run().catch(error => {
    console.error("Bootstrap Scheduler runtime integration test failed:",
        error.message);
    process.exitCode = 1;
});
