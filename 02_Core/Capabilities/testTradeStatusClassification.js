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

    for (const field of [
        "totalTrades",
        "closedTrades",
        "wins",
        "losses",
        "breakEven",
        "cancelled",
        "pending"
    ]) {
        assert.ok(Number.isInteger(summary[field]) && summary[field] >= 0);
    }

    assert.strictEqual(
        summary.closedTrades,
        summary.wins + summary.losses + summary.breakEven
    );
    assert.strictEqual(
        summary.closedTrades + summary.cancelled + summary.pending,
        summary.totalTrades
    );
    assert.ok(Number.isFinite(summary.winRate));
    assert.ok(summary.winRate >= 0 && summary.winRate <= 1);
    assert.ok(Number.isFinite(summary.averageRR));
    assert.ok(Number.isFinite(summary.netRR));

    console.log(summary);
}

run().catch(error => {
    console.error("Trade status classification test failed:", error.message);
    process.exitCode = 1;
});
