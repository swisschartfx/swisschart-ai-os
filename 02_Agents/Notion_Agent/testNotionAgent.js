const assert = require("assert");

const NotionAgent = require("./notionAgent");

async function run() {
    const agent = new NotionAgent({
        mockTrades: [
            {
                tradeId: "SCT-2646",
                pair: "EURUSD",
                result: "Win",
                finalRR: 2
            },
            {
                tradeId: "SCT-2647",
                pair: "GBPUSD",
                result: "Loss",
                finalRR: -1
            },
            {
                tradeId: "SCT-2648",
                pair: "EURUSD",
                result: "Pending",
                finalRR: null
            }
        ]
    });

    const history = await agent.handleRequest({
        action: "getTradeHistory",
        filters: { pair: "EURUSD" }
    });
    assert.strictEqual(history.status, "success");
    assert.strictEqual(history.count, 2);
    assert.strictEqual(history.trades[0].tradeId, "SCT-2646");

    const performance = await agent.handleRequest({
        action: "getPerformanceSummary"
    });
    assert.strictEqual(performance.status, "success");
    assert.deepStrictEqual(performance.summary, {
        totalTrades: 3,
        completedTrades: 2,
        wins: 1,
        losses: 1,
        breakeven: 0,
        winRate: 0.5,
        totalRR: 1,
        averageRR: 0.5
    });

    const empty = await agent.getTradeHistory({ pair: "USDJPY" });
    assert.strictEqual(empty.status, "empty");
    assert.strictEqual(empty.count, 0);
    assert.deepStrictEqual(empty.trades, []);

    console.log("Notion Agent mock tests passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
