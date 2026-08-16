const assert = require("assert");

const NotionAutomationCapability = require("./notionAutomationCapability");

async function run() {
    const calls = [];
    const journalAgent = {
        async readTrades() {
            calls.push("readTrades");
            return [
                { tradeId: "SCT-1", pair: "EURUSD", result: "Win", finalRR: 2 },
                { tradeId: "SCT-2", pair: "GBPUSD", result: "Loss", finalRR: -1 }
            ];
        }
    };
    const capability = new NotionAutomationCapability({ journalAgent });

    const history = await capability.execute({
        intent: "get_trade_history",
        filters: { pair: "EURUSD" }
    });
    assert.deepStrictEqual(history, {
        type: "notion_result",
        data: {
            type: "trade_history",
            count: 1,
            trades: [
                { tradeId: "SCT-1", pair: "EURUSD", result: "Win", finalRR: 2 }
            ]
        }
    });

    const performance = await capability.execute({
        intent: "get_performance_summary"
    });
    assert.deepStrictEqual(performance, {
        type: "notion_result",
        data: {
            type: "performance_summary",
            totalTrades: 2,
            completedTrades: 2,
            wins: 1,
            losses: 1,
            breakeven: 0,
            winRate: 0.5,
            totalRR: 1
        }
    });
    assert.deepStrictEqual(calls, ["readTrades", "readTrades"]);

    console.log("Notion Automation Capability test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
