const assert = require("assert");
const path = require("path");

const SwisschartAssistant = require("./01_assistant");
const TaskEngine = require("../Task_Engine/02_taskEngine");
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
    const taskEngineCalls = [];
    let publishingExecutorCalls = 0;
    const realNotionCapability = new NotionCapability();
    const realFormatter = new TelegramFormatterCapability();
    const taskEngine = new TaskEngine({
        executors: {
            "publishing-agent": {
                async execute() {
                    publishingExecutorCalls += 1;
                    throw new Error("Publishing executor must not be called");
                }
            }
        }
    });
    const observedTaskEngine = {
        async execute(request) {
            taskEngineCalls.push(request);
            return taskEngine.execute(request);
        }
    };
    const workflow = new PerformanceSummaryTelegramWorkflow({
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
        taskEngine: observedTaskEngine
    });
    const assistant = new SwisschartAssistant({
        taskEngine,
        performanceSummaryTelegramWorkflow: workflow
    });

    const execution = await assistant.handle(
        "publish performance summary",
        { sourceReference: "real-performance-summary-publication-test" }
    );

    assert.deepStrictEqual(notionCalls, [{
        intent: "get_performance_summary",
        source: "trading_journal"
    }]);
    assert.strictEqual(formatterCalls.length, 1);
    assert.ok(formatterCalls[0].totalTrades > 0);
    assert.strictEqual(taskEngineCalls.length, 1);
    assert.strictEqual(taskEngineCalls[0].intent, "content.publish");
    assert.strictEqual(
        taskEngineCalls[0].capabilityRequirement,
        "publishing.publish"
    );
    assert.strictEqual(typeof taskEngineCalls[0].input.message, "string");
    assert.ok(taskEngineCalls[0].input.message.trim().length > 0);
    assert.deepStrictEqual(taskEngineCalls[0].approval, {
        required: true,
        status: "pending"
    });
    assert.strictEqual(execution.task.approval.status, "pending");
    assert.strictEqual(execution.task.status, "blocked");
    assert.strictEqual(
        execution.task.terminalReason,
        "AWAITING_FOUNDER_APPROVAL"
    );
    assert.strictEqual(publishingExecutorCalls, 0);

    console.log("Publish Performance Summary Workflow test passed");
}

run().catch(error => {
    console.error("Publish Performance Summary Workflow test failed:",
        error.message);
    process.exitCode = 1;
});
