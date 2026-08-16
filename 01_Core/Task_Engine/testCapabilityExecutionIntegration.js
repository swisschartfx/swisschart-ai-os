const assert = require("assert");

const AutomationExecutionRouter = require("./automationExecutionRouter");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const NotionCapability = require("../../02_Core/Capabilities/notionCapability");
const TelegramFormatterCapability = require("../../02_Core/Capabilities/telegramFormatterCapability");

async function run() {
    const registry = new CapabilityRegistry();
    registry.register(new NotionCapability());
    registry.register(new TelegramFormatterCapability());
    const router = new AutomationExecutionRouter({
        capabilityRegistry: registry
    });

    const performance = await router.execute({
        action: {
            capabilityRequirement: "notion",
            intent: "get_performance_summary",
            input: { source: "trading_journal" }
        }
    });
    assert.deepStrictEqual(performance, {
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        averageRR: 0
    });

    const formatted = await router.execute({
        action: {
            capabilityRequirement: "telegram_formatter",
            intent: "format_performance_report",
            input: performance
        }
    });
    assert.strictEqual(formatted.type, "telegram_message");
    assert.match(formatted.message, /Swisschart Performance/);

    await assert.rejects(
        () => router.execute({
            action: {
                capabilityRequirement: "unknown",
                intent: "execute",
                input: {}
            }
        }),
        error => error.code === "AUTOMATION_CAPABILITY_UNSUPPORTED"
    );

    assert.strictEqual(router.notionCapability, undefined);
    assert.strictEqual(router.telegramFormatter, undefined);
    assert.strictEqual(router.scheduler, undefined);
    console.log("Capability Execution integration test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
