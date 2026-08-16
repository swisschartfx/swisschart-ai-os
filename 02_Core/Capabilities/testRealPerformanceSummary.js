const assert = require("assert");

const NotionCapability = require("./notionCapability");

async function run() {
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!process.env.NOTION_API_TOKEN) {
        throw new Error("NOTION_API_TOKEN is required");
    }

    if (!databaseId) {
        throw new Error("NOTION_DATABASE_ID is required");
    }

    const capability = new NotionCapability();
    const summary = await capability.execute({
        intent: "get_performance_summary",
        source: "trading_journal",
        databaseId
    });

    assert.ok(Number.isInteger(summary.trades) && summary.trades >= 0);
    assert.ok(Number.isInteger(summary.wins) && summary.wins >= 0);
    assert.ok(Number.isInteger(summary.losses) && summary.losses >= 0);
    assert.ok(summary.wins + summary.losses <= summary.trades);
    assert.ok(Number.isFinite(summary.winRate));
    assert.ok(summary.winRate >= 0 && summary.winRate <= 1);
    assert.ok(Number.isFinite(summary.averageRR));
    assert.ok(Number.isFinite(summary.netRR));

    console.log(summary);
}

run().catch(error => {
    console.error("Real performance summary test failed:", error.message);
    process.exitCode = 1;
});
