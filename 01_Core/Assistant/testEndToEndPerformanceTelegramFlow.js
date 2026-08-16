const assert = require("assert");
const path = require("path");

const SwisschartAssistant = require("./01_assistant");
const TaskEngine = require("../Task_Engine/02_taskEngine");
const PublishingAgentExecutor = require(
    "../Task_Engine/05_publishingAgentExecutor"
);
const NotionCapability = require("../../02_Core/Capabilities/notionCapability");
const TelegramFormatterCapability = require(
    "../../02_Core/Capabilities/telegramFormatterCapability"
);
const PerformanceSummaryTelegramWorkflow = require(
    "../../03_Workflows/performanceSummaryTelegramWorkflow"
);
const dotenv = require(
    "../../02_Agents/01_Journal_Agent/node_modules/dotenv"
);

dotenv.config({
    path: path.join(__dirname, "../../.env"),
    override: true,
    quiet: true
});

async function run() {
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!process.env.NOTION_API_TOKEN) {
        throw new Error("NOTION_API_TOKEN is required");
    }

    if (!databaseId) {
        throw new Error("NOTION_DATABASE_ID is required");
    }

    const notionCalls = [];
    const formatterCalls = [];
    const workflowCalls = [];
    const publishedMessages = [];
    const realNotionCapability = new NotionCapability();
    const realFormatter = new TelegramFormatterCapability();
    const mockPublishingAgent = {
        async publishContent(message) {
            publishedMessages.push(message);
            return {
                message_id: "mock-performance-message-1",
                chat: { id: "mock-telegram-channel" },
                text: message,
                mock: true
            };
        }
    };
    const taskEngine = new TaskEngine({
        taskIdGenerator: () => "task-performance-telegram-e2e",
        executors: {
            "publishing-agent": new PublishingAgentExecutor({
                publisherFactory: () => mockPublishingAgent
            })
        }
    });
    const realWorkflow = new PerformanceSummaryTelegramWorkflow({
        notionCapability: {
            async execute(request) {
                notionCalls.push(request);
                return realNotionCapability.execute({
                    ...request,
                    databaseId
                });
            }
        },
        telegramFormatterCapability: {
            async execute(request) {
                formatterCalls.push(request);
                return realFormatter.execute(request);
            }
        },
        taskEngine
    });
    const observedWorkflow = {
        async execute(request) {
            workflowCalls.push(request);
            return realWorkflow.execute(request);
        }
    };
    const assistant = new SwisschartAssistant({
        taskEngine,
        performanceSummaryTelegramWorkflow: observedWorkflow
    });

    const pending = await assistant.handle(
        "publish performance summary",
        { sourceReference: "founder-performance-telegram-e2e" }
    );

    assert.deepStrictEqual(workflowCalls, [{
        source: "founder",
        sourceReference: "founder-performance-telegram-e2e"
    }]);
    assert.deepStrictEqual(notionCalls, [{
        intent: "get_performance_summary",
        source: "trading_journal"
    }]);
    assert.strictEqual(formatterCalls.length, 1);
    assert.ok(formatterCalls[0].totalTrades > 0);
    assert.strictEqual(pending.task.capabilityRequirement, "publishing.publish");
    assert.deepStrictEqual(pending.task.approval, {
        required: true,
        status: "pending"
    });
    assert.strictEqual(pending.task.status, "blocked");
    assert.strictEqual(
        pending.task.terminalReason,
        "AWAITING_FOUNDER_APPROVAL"
    );
    assert.strictEqual(typeof pending.task.input.message, "string");
    assert.ok(pending.task.input.message.trim().length > 0);
    assert.strictEqual(publishedMessages.length, 0);

    const taskId = pending.task.taskId;
    const approved = await assistant.handle(`approve task ${taskId}`);

    assert.strictEqual(approved.taskId, taskId);
    assert.strictEqual(approved.taskStatus, "completed");
    assert.strictEqual(publishedMessages.length, 1);
    assert.strictEqual(publishedMessages[0], pending.task.input.message);
    assert.match(publishedMessages[0], /Swisschart Performance/);

    console.log("End-to-end Performance Telegram flow test passed");
}

run().catch(error => {
    console.error("End-to-end Performance Telegram flow test failed:",
        error.message);
    process.exitCode = 1;
});
