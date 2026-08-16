const assert = require("assert");

const CapabilityRegistry = require("./capabilityRegistry");
const NotionCapability = require("./notionCapability");
const TelegramFormatterCapability = require("./telegramFormatterCapability");

function run() {
const registry = new CapabilityRegistry();
    const notion = new NotionCapability();
    const formatter = new TelegramFormatterCapability();

    assert.strictEqual(registry.register(notion), notion);
    assert.strictEqual(registry.has("notion"), true);
    assert.strictEqual(registry.get("notion"), notion);

    registry.register(formatter);
    assert.strictEqual(registry.has("telegram_formatter"), true);
    assert.strictEqual(registry.get("telegram_formatter"), formatter);

    assert.strictEqual(registry.has("unknown"), false);
    assert.strictEqual(registry.get("unknown"), null);

    assert.strictEqual(registry.execute, undefined);
    assert.strictEqual(registry.workflow, undefined);
    assert.strictEqual(registry.telegramService, undefined);
    assert.strictEqual(registry.notionClient, undefined);
console.log("Capability Registry test passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
