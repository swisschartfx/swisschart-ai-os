const assert = require("assert");
const path = require("path");
const dotenv = require("../../02_Agents/01_Journal_Agent/node_modules/dotenv");

dotenv.config({ path: path.join(__dirname, "../../.env"), override: true, quiet: true });

const runtime = require("../bootstrap");

async function run() {
    if (!process.env.NOTION_API_TOKEN || !process.env.NOTION_DATABASE_ID) {
        throw new Error("NOTION_API_TOKEN and NOTION_DATABASE_ID are required");
    }

    const response = await runtime.assistant.handle(
        "Performance this month چطوره؟"
    );

    assert.strictEqual(response.success, true);
    assert.strictEqual(response.intent, "current_month_trading_performance");
    assert.strictEqual(response.capabilityResult.status, "completed");
    assert.strictEqual(
        response.capabilityResult.executionMetadata.period,
        "current_month"
    );
    assert.strictEqual(typeof response.message, "string");
    assert.ok(response.message.includes("win rate"));
    assert.ok(response.message.includes("net RR"));
    console.log(response.message);
    console.log("Real current-month performance conversation proof passed");
}

run().catch((error) => {
    console.error("Real conversation proof failed:", error.message);
    process.exitCode = 1;
});
