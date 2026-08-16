const assert = require("assert");

const PerformanceSummaryTelegramWorkflow = require(
    "./performanceSummaryTelegramWorkflow"
);

async function run() {
    const notionCalls = [];
    const formatterCalls = [];
    const taskEngineCalls = [];
    const summary = {
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
    const formatted = {
        type: "telegram_message",
        message: "Formatted Swisschart performance message"
    };
    const taskEngineResult = {
        task: {
            taskId: "task-performance-summary",
            status: "blocked",
            terminalReason: "AWAITING_FOUNDER_APPROVAL"
        },
        result: {
            status: "blocked"
        }
    };
    const notionCapability = {
        async execute(request) {
            notionCalls.push(request);
            return summary;
        }
    };
    const telegramFormatterCapability = {
        async execute(request) {
            formatterCalls.push(request);
            return formatted;
        }
    };
    const taskEngine = {
        async execute(request) {
            taskEngineCalls.push(request);
            return taskEngineResult;
        }
    };
    const workflow = new PerformanceSummaryTelegramWorkflow({
        notionCapability,
        telegramFormatterCapability,
        taskEngine
    });

    const result = await workflow.execute({
        source: "test",
        sourceReference: "performance-summary-test"
    });

    assert.deepStrictEqual(notionCalls, [{
        intent: "get_performance_summary",
        source: "trading_journal"
    }]);
    assert.deepStrictEqual(formatterCalls, [{
        intent: "format_performance_report",
        ...summary
    }]);
    assert.strictEqual(taskEngineCalls.length, 1);
    assert.strictEqual(taskEngineCalls[0].intent, "content.publish");
    assert.strictEqual(
        taskEngineCalls[0].capabilityRequirement,
        "publishing.publish"
    );
    assert.deepStrictEqual(taskEngineCalls[0].approval, {
        required: true,
        status: "pending"
    });
    assert.strictEqual(taskEngineCalls[0].input.message, formatted.message);
    assert.strictEqual(workflow.telegramPublisher, undefined);
    assert.strictEqual(workflow.telegramService, undefined);
    assert.strictEqual(result, taskEngineResult);

    console.log("Performance Summary Telegram Workflow test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
