const assert = require("assert");
const path = require("path");
const dotenv = require("../../02_Agents/01_Journal_Agent/node_modules/dotenv");

dotenv.config({ path: path.join(__dirname, "../../.env"), override: true, quiet: true });

const runtime = require("../bootstrap");

async function run() {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
        throw new Error("OPENAI_API_KEY and OPENAI_MODEL are required");
    }
    if (!process.env.NOTION_API_TOKEN || !process.env.NOTION_DATABASE_ID) {
        throw new Error("NOTION_API_TOKEN and NOTION_DATABASE_ID are required");
    }

    const question = "Max consecutive losses این ماه چقدر بوده؟";
    const fixedAnalytics = runtime.capabilityRegistry.get("trading.analytics");
    assert.ok(fixedAnalytics);
    assert.strictEqual(
        fixedAnalytics.supportedMetrics.includes("max_consecutive_losses"),
        false
    );

    const response = await runtime.assistant.handle(question);

    assert.strictEqual(response.success, true);
    assert.strictEqual(response.intent, "general_trading_analysis");
    assert.ok(response.capabilityResult);
    assert.strictEqual(response.capabilityResult.capability,
        "trading.general_analysis");
    assert.strictEqual(response.capabilityResult.operation,
        "trading.general_analysis.execute");
    assert.strictEqual(response.capabilityResult.data.status, "completed");
    assert.strictEqual(response.capabilityResult.data.period, "current_month");
    assert.strictEqual(typeof response.capabilityResult.data.result, "number");
    assert.ok(Number.isInteger(response.capabilityResult.data.result));
    assert.ok(response.capabilityResult.data.result >= 0);
    assert.strictEqual(response.providerMetadata.provider, "openai");
    assert.strictEqual(
        response.providerMetadata.request.activity,
        "assistant.trading_analysis_planning"
    );
    assert.ok(Number.isInteger(response.providerMetadata.usage.totalTokens));

    const founderVisible = response.message;
    assert.strictEqual(typeof founderVisible, "string");
    assert.ok(founderVisible.includes(String(response.capabilityResult.data.result)));
    assert.strictEqual(founderVisible.includes("Notion"), false);
    assert.strictEqual(founderVisible.includes("databaseId"), false);
    assert.strictEqual(founderVisible.includes("NOTION_"), false);
    assert.strictEqual(founderVisible.includes("OPENAI_API_KEY"), false);

    console.log({ question, response });
    console.log("Real adaptive Max Consecutive Losses E2E proof passed");
}

run().catch((error) => {
    console.error("Real adaptive analysis E2E proof failed:", error.message);
    process.exitCode = 1;
});
