const assert = require("assert");

const NotionCapability = require("./notionCapability");

async function run() {
    const capability = new NotionCapability();
    const summary = await capability.execute({
        intent: "get_performance_summary",
        source: "trading_journal"
    });

    assert.strictEqual(capability.name, "notion");
    assert.deepStrictEqual(summary, {
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        averageRR: 0
    });

    await assert.rejects(
        () => capability.execute({
            intent: "unknown_intent",
            source: "trading_journal"
        }),
        error => error.code === "NOTION_CAPABILITY_INTENT_UNSUPPORTED"
    );

    assert.strictEqual(capability.telegramService, undefined);
    assert.strictEqual(capability.publisher, undefined);
    assert.strictEqual(capability.notionClient, undefined);
    console.log("Notion Capability test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
