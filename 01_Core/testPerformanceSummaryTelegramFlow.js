const assert = require("assert");
const path = require("path");
const dotenv = require(
    "../02_Agents/01_Journal_Agent/node_modules/dotenv"
);

dotenv.config({
    path: path.join(__dirname, "../.env"),
    override: true,
    quiet: true
});

const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;
const mockTimer = { id: "performance-summary-runtime-test" };

global.setInterval = () => mockTimer;
global.clearInterval = () => {};

const runtime = require("./start");
dotenv.config({
    path: path.join(__dirname, "../.env"),
    override: true,
    quiet: true
});
const PublishingAgentExecutor = require(
    "./Task_Engine/05_publishingAgentExecutor"
);

async function run() {
    runtime.schedulerRuntime.stop();
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;

    const workflow = runtime.assistant.performanceSummaryTelegramWorkflow;
    const taskEngine = runtime.assistant.taskEngine;
    const originalNotionExecute =
        workflow.notionCapability.execute.bind(workflow.notionCapability);
    const originalFormatterExecute =
        workflow.telegramFormatterCapability.execute.bind(
            workflow.telegramFormatterCapability
        );
    const originalExecutor = taskEngine.executors["publishing-agent"];
    const notionResults = [];
    const formatterResults = [];
    const executorInstructions = [];
    const publishedMessages = [];
    const mockPublishingAgent = {
        async publishContent(message) {
            publishedMessages.push(message);
            return {
                message_id: "mock-performance-summary-message-1",
                chat: { id: "mock-telegram-primary" },
                text: message,
                mock: true
            };
        }
    };
    const publishingExecutor = new PublishingAgentExecutor({
        publisherFactory: () => mockPublishingAgent
    });

    workflow.notionCapability.execute = async request => {
        const summary = await originalNotionExecute({
            ...request,
            databaseId: process.env.NOTION_DATABASE_ID
        });
        notionResults.push(summary);
        return summary;
    };
    workflow.telegramFormatterCapability.execute = async request => {
        const formatted = await originalFormatterExecute(request);
        formatterResults.push(formatted);
        return formatted;
    };
    taskEngine.executors["publishing-agent"] = {
        async execute(instruction) {
            executorInstructions.push(instruction);
            return publishingExecutor.execute(instruction);
        }
    };

    try {
        const pending = await runtime.assistant.handle(
            "publish performance summary",
            { sourceReference: "performance-summary-runtime-flow" }
        );

        assert.strictEqual(notionResults.length, 1);
        assert.ok(notionResults[0].totalTrades > 0);
        assert.strictEqual(formatterResults.length, 1);
        assert.strictEqual(formatterResults[0].type, "telegram_message");
        assert.strictEqual(typeof formatterResults[0].message, "string");
        assert.ok(formatterResults[0].message.trim().length > 0);

        assert.strictEqual(pending.task.intent, "content.publish");
        assert.strictEqual(
            pending.task.capabilityRequirement,
            "publishing.publish"
        );
        assert.strictEqual(
            pending.task.input.destination,
            "telegram.primary"
        );
        assert.strictEqual(
            pending.task.input.message,
            formatterResults[0].message
        );
        assert.deepStrictEqual(pending.task.approval, {
            required: true,
            status: "pending"
        });
        assert.strictEqual(pending.task.status, "blocked");
        assert.strictEqual(executorInstructions.length, 0);
        assert.strictEqual(publishedMessages.length, 0);

        const taskId = pending.task.taskId;
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
            formatterResults[0].message
        );
        assert.deepStrictEqual(
            publishedMessages,
            [formatterResults[0].message]
        );

        console.log("Performance Summary Telegram runtime flow test passed");
    } finally {
        workflow.notionCapability.execute = originalNotionExecute;
        workflow.telegramFormatterCapability.execute =
            originalFormatterExecute;
        taskEngine.executors["publishing-agent"] = originalExecutor;
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
    }
}

run().catch(error => {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    console.error("Performance Summary Telegram runtime flow test failed:",
        error.message);
    process.exitCode = 1;
});
