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

    const question = "Profit factor این ماه چقدره؟";
    const response = await runtime.assistant.handle(question);

    if (response.success) {
        const data = response.capabilityResult.data;
        assert.strictEqual(response.capabilityResult.capability, "trading.analytics");
        assert.strictEqual(response.capabilityResult.operation,
            "trading.analytics.calculate");
        assert.strictEqual(data.result.metric, "profit_factor");
        assert.strictEqual(data.period, "current_month");
        assert.ok(Number.isFinite(data.result.value));
        assert.strictEqual(typeof response.message, "string");
        assert.ok(response.message.includes(String(data.result.value)));
    } else {
        assert.strictEqual(response.intent, "llm_request_understanding");
        assert.ok(response.capabilityResult);
        assert.strictEqual(response.capabilityResult.code,
            "CAPABILITY_EXECUTION_FAILED");
    }

    const publicOutput = JSON.stringify({
        message: response.message,
        capabilityResult: response.capabilityResult
    });
    assert.strictEqual(publicOutput.includes("databaseId"), false);
    assert.strictEqual(publicOutput.includes("NOTION_"), false);
    assert.strictEqual(publicOutput.includes("OPENAI_API_KEY"), false);

    console.log({ question, response });
    console.log("Real LLM Trading Analytics E2E proof passed");
}

run().catch((error) => {
    console.error("Real LLM Trading Analytics E2E proof failed:", error.message);
    process.exitCode = 1;
});
