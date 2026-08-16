const assert = require("assert");

const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;
const mockTimer = { id: "telegram-automation-e2e-timer" };

global.setInterval = () => mockTimer;
global.clearInterval = () => {};

const runtime = require("./start");
const PublishingAgentExecutor = require(
    "./Task_Engine/05_publishingAgentExecutor"
);

async function run() {
    runtime.schedulerRuntime.stop();
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;

    const creationTime = new Date("2026-08-12T12:00:00.000Z");
    const executionTime = new Date("2026-08-13T05:01:00.000Z");
    const automationId = "telegram-automation-e2e-test";
    const expectedMessage = "Swisschart AI OS test message";
    const executorInstructions = [];
    const publishingAgentMessages = [];
    const taskEngine = runtime.assistant.taskEngine;
    const originalExecutor = taskEngine.executors["publishing-agent"];
    const originalGetScheduledEvents =
        runtime.schedulerRuntime.getScheduledEvents;

    const mockPublishingAgent = {
        async publishContent(message) {
            publishingAgentMessages.push(message);
            return {
                message_id: "mock-telegram-automation-message-1",
                chat: { id: "mock-telegram-primary" },
                text: message,
                mock: true
            };
        }
    };
    const publishingExecutor = new PublishingAgentExecutor({
        publisherFactory: () => mockPublishingAgent
    });
    taskEngine.executors["publishing-agent"] = {
        async execute(instruction) {
            executorInstructions.push(instruction);
            return publishingExecutor.execute(instruction);
        }
    };

    runtime.assistant.founderCommandParser.clock = () => creationTime;
    runtime.assistant.founderCommandParser.automationIdGenerator =
        () => automationId;
    runtime.assistant.automationSchedulerBridge.clock = () => executionTime;
    runtime.schedulerRuntime.clock = () => executionTime;
    runtime.eventEngine.clock = () => executionTime;
    runtime.schedulerRuntime.getScheduledEvents = () =>
        runtime.assistant.automationSchedulerBridge.getScheduledEvents()
            .filter(event => event.name === automationId);

    try {
        const automation = await runtime.assistant.handle(
            "schedule telegram message Swisschart AI OS test message tomorrow at 8 AM"
        );

        assert.strictEqual(automation.automationId, automationId);
        assert.ok(
            runtime.assistant.automationManager.getAutomation(automationId)
        );

        const evaluations = await runtime.schedulerRuntime.tick();
        assert.strictEqual(evaluations.length, 1);

        const scheduledTask =
            evaluations[0].taskExecutions[0].execution.task;
        assert.strictEqual(
            scheduledTask.capabilityRequirement,
            "publishing.publish"
        );
        assert.strictEqual(scheduledTask.intent, "content.publish");
        assert.strictEqual(
            scheduledTask.input.destination,
            "telegram.primary"
        );
        assert.strictEqual(scheduledTask.input.message, expectedMessage);
        assert.deepStrictEqual(scheduledTask.approval, {
            required: true,
            status: "pending",
            reason: "External event publication requires explicit founder approval."
        });
        assert.strictEqual(scheduledTask.status, "blocked");
        assert.strictEqual(executorInstructions.length, 0);

        const taskId = scheduledTask.taskId;
        const approved = await runtime.assistant.handle(
            `approve task ${taskId}`
        );

        assert.strictEqual(approved.taskId, taskId);
        assert.strictEqual(approved.taskStatus, "completed");
        assert.strictEqual(executorInstructions.length, 1);
        assert.strictEqual(executorInstructions[0].taskId, taskId);
        assert.strictEqual(
            executorInstructions[0].destination,
            "telegram.primary"
        );
        assert.strictEqual(
            executorInstructions[0].message,
            expectedMessage
        );
        assert.deepStrictEqual(
            publishingAgentMessages,
            [expectedMessage]
        );

        console.log("End-to-end Telegram automation flow test passed");
    } finally {
        runtime.assistant.automationManager.deleteAutomation(automationId);
        taskEngine.executors["publishing-agent"] = originalExecutor;
        runtime.schedulerRuntime.getScheduledEvents =
            originalGetScheduledEvents;
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
    }
}

run().catch(error => {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    console.error("End-to-end Telegram automation flow test failed:",
        error.message);
    process.exitCode = 1;
});
