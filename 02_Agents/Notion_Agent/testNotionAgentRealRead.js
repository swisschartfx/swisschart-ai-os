const assert = require("assert");

const NotionAgent = require("./notionAgent");

async function run() {
    const agent = new NotionAgent({ mode: "real" });
    const history = await agent.getTradeHistory();

    assert.strictEqual(history.type, "trade_history");
    assert.ok(["success", "empty"].includes(history.status));
    assert.ok(Array.isArray(history.trades));
    assert.strictEqual(history.count, history.trades.length);

    console.log(`Notion Agent real read passed (${history.count} trades read)`);
}

run().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
