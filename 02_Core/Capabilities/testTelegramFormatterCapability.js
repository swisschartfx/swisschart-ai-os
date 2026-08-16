const assert = require("assert");

const TelegramFormatterCapability = require("./telegramFormatterCapability");

async function run() {
    const capability = new TelegramFormatterCapability();
    const result = await capability.execute({
        intent: "format_performance_report",
        totalTrades: 24,
        closedTrades: 20,
        wins: 12,
        losses: 8,
        breakEven: 0,
        cancelled: 1,
        pending: 3,
        winRate: 0.6,
        averageRR: 1.35,
        netRR: 27
    });

    assert.strictEqual(capability.name, "telegram_formatter");
    assert.strictEqual(result.type, "telegram_message");
    assert.match(result.message, /Swisschart Performance/);
    assert.match(result.message, /Total trades: 24/);
    assert.match(result.message, /Closed trades: 20/);
    assert.match(result.message, /Wins: 12 \| Losses: 8 \| Break-even: 0/);
    assert.match(result.message, /Cancelled: 1 \| Pending: 3/);
    assert.match(result.message, /Win rate: 60\.0%/);
    assert.match(result.message, /Average R: 1\.35/);
    assert.match(result.message, /Net R: 27/);

    const safeMissingValues = await capability.execute({
        intent: "format_performance_report"
    });
    assert.match(safeMissingValues.message, /Total trades: 0/);
    assert.match(safeMissingValues.message, /Net R: 0/);

    await assert.rejects(
        () => capability.execute({ intent: "unknown_intent" }),
        error => error.code === "TELEGRAM_FORMATTER_INTENT_UNSUPPORTED"
    );

    assert.strictEqual(capability.telegramService, undefined);
    assert.strictEqual(capability.publisher, undefined);
    assert.strictEqual(capability.approvalGate, undefined);
    console.log("Telegram Formatter Capability test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
