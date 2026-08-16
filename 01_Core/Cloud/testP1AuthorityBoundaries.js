const assert = require("assert");
const fs = require("fs");
const path = require("path");
const TradingDataCapability = require("../../02_Core/Capabilities/tradingDataCapability");
const TelegramSignalCapability = require("../../02_Core/Capabilities/telegramSignalCapability");

const root = path.resolve(__dirname, "../..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

async function run() {
    const assistantSource = read("01_Core/Assistant/01_assistant.js");
    assert(!assistantSource.includes("return this.handleAutomationRequest("));
    assert(assistantSource.includes("LEGACY_AUTOMATION_MUTATION_BYPASS_DISABLED"));
    assert(assistantSource.includes("LEGACY_TELEGRAM_PUBLISH_BYPASS_DISABLED"));
    assert(assistantSource.includes("LEGACY_TASK_APPROVAL_BYPASS_DISABLED"));
    assert(!assistantSource.includes("this.taskEngine.founderApprovalController.approve("));
    assert(assistantSource.includes('capability: "publishing.telegram"'));

    const telegramSource = read("02_Core/Capabilities/telegramSignalCapability.js");
    assert(!telegramSource.includes("NotionService"));
    assert(!telegramSource.includes("NOTION_DATABASE_ID"));
    assert(!telegramSource.includes("databaseId"));

    let providerRequest;
    const tradingData = new TradingDataCapability({
        tradingDataSource: { async execute(request) {
            providerRequest = request;
            return { matchCount: 1, reference: {
                entityType: "trade", entityId: request.tradeId,
                source: "trading_journal", externalReference: "provider-record"
            } };
        } }
    });
    const resolved = await tradingData.execute({
        operation: "trading.trade_reference.resolve",
        input: { tradeId: "SCT-2647" }
    });
    assert.strictEqual(resolved.data.exists, true);
    assert.strictEqual(providerRequest.intent, "resolve_trade_reference");
    assert.strictEqual(Object.hasOwn(providerRequest, "databaseId"), false);

    let sends = 0;
    const telegram = new TelegramSignalCapability({
        tradingDataCapability: tradingData,
        publisher: { async publishContent() { sends += 1; return { message_id: 900 }; } }
    });
    const published = await telegram.execute({
        input: { signalReference: "SCT-2647", renderedMessage: "mock",
            messageRole: "signal" },
        context: { approvalVerified: true, payloadHash: "hash",
            idempotencyKey: "publish-1" }, constraints: {}
    });
    assert.strictEqual(published.data.messageId, 900);
    assert.strictEqual(sends, 1);

    const packageScripts = JSON.parse(read("package.json")).scripts;
    assert(!Object.values(packageScripts).some(script =>
        script.includes("manual/external")));
    console.log("P1 authority and provider-neutral boundary tests passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
