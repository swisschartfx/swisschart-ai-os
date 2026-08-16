const assert = require("assert");

const SwisschartAssistant = require("./01_assistant");
const TaskEngine = require("../Task_Engine/02_taskEngine");
const RuleResolver = require("../Rule_Layer/03_ruleResolver");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const CapabilityGateway = require("../../02_Core/Capabilities/capabilityGateway");
const TradingDataCapability = require("../../02_Core/Capabilities/tradingDataCapability");
const TelegramPublishingCapability = require(
    "../../02_Core/Capabilities/telegramPublishingCapability"
);

async function run() {
    const publishingCalls = [];
    const tradingSourceCalls = [];
    const taskEngine = new TaskEngine({
        taskIdGenerator: () => "task-assistant-telegram-1",
        resultIdGenerator: () => "result-assistant-telegram-1",
        executors: {
            "publishing-agent": {
                async execute(instruction) {
                    publishingCalls.push(instruction);
                    throw new Error("Pending publication must not execute");
                }
            }
        }
    });
    const ruleResolver = new RuleResolver();
    const registry = new CapabilityRegistry([
        new TradingDataCapability({
            tradingDataSource: {
                async execute(request) {
                    tradingSourceCalls.push(request);
                    return {
                        totalTrades: 45,
                        closedTrades: 38,
                        wins: 12,
                        losses: 23,
                        breakEven: 3,
                        cancelled: 7,
                        pending: 0,
                        winRate: 12 / 35,
                        averageRR: 3.646578947368421,
                        netRR: 138.57
                    };
                }
            }
        }),
        new TelegramPublishingCapability({ taskEngine, ruleResolver })
    ]);
    const capabilityGateway = new CapabilityGateway({ registry });
    const assistant = new SwisschartAssistant({
        testMode: true,
        taskEngine,
        ruleResolver,
        capabilityGateway,
        notionAgent: { handleRequest() {} },
        telegramPublishingWorkflow: { execute() {} },
        performanceSummaryTelegramWorkflow: { execute() {} }
    });

    const tradingResult = await assistant.handle({
        type: "capability",
        requestId: "assistant-trading-request-1",
        capability: "trading.data",
        operation: "trading.performance.summary",
        input: {},
        requestedBy: "founder",
        source: "assistant-shell",
        timestamp: "2026-08-13T15:00:00.000Z"
    });

    assert.strictEqual(tradingResult.status, "completed");
    assert.strictEqual(tradingResult.capability, "trading.data");
    assert.strictEqual(tradingResult.data.totalTrades, 45);
    assert.deepStrictEqual(tradingSourceCalls, [{
        intent: "get_performance_summary",
        source: "trading_journal"
    }]);

    const publishingResult = await assistant.handle({
        type: "capability",
        requestId: "assistant-publishing-request-1",
        capability: "publishing.telegram",
        operation: "publishing.telegram.publish",
        input: { message: "Mocked Assistant Gateway publication" },
        requestedBy: "founder",
        source: "assistant-shell",
        timestamp: "2026-08-13T15:01:00.000Z"
    });

    assert.strictEqual(publishingResult.status, "blocked");
    assert.strictEqual(publishingResult.capability, "publishing.telegram");
    assert.strictEqual(publishingResult.data.taskId, "task-assistant-telegram-1");
    assert.strictEqual(publishingResult.data.approvalRequired, true);
    assert.strictEqual(publishingResult.data.approvalStatus, "pending");
    assert.strictEqual(publishingResult.data.blocker.code,
        "AWAITING_FOUNDER_APPROVAL");
    assert.strictEqual(taskEngine.tasks.has("task-assistant-telegram-1"), true);
    assert.strictEqual(publishingCalls.length, 0);

    console.log("Assistant Capability Gateway integration test passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
