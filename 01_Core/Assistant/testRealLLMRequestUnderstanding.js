const assert = require("assert");
const path = require("path");
const dotenv = require("../../02_Agents/01_Journal_Agent/node_modules/dotenv");

dotenv.config({ path: path.join(__dirname, "../../.env"), override: true, quiet: true });

const runtime = require("../bootstrap");

async function run() {
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
        throw new Error("OPENAI_API_KEY and OPENAI_MODEL are required");
    }
    const result = await runtime.assistant.requestUnderstanding.understand(
        "Profit factor این ماه چقدره؟"
    );
    assert.strictEqual(result.understanding.requestedMetric, "profit_factor");
    assert.strictEqual(result.understanding.period, "current_month");
    assert.strictEqual(result.understanding.calculationRequired, true);
    assert.strictEqual(result.understanding.capabilityCandidate,
        "trading.analytics");
    assert.strictEqual(result.understanding.operationCandidate,
        "trading.analytics.calculate");
    assert.strictEqual(result.executable, true);
    assert.ok(result.capabilityRequest);
    assert.strictEqual(result.capabilityRequest.capability, "trading.analytics");
    assert.strictEqual(result.capabilityRequest.operation,
        "trading.analytics.calculate");
    console.log(result);
    console.log("Real LLM Request Understanding proof passed");
}

run().catch((error) => {
    console.error("Real LLM Request Understanding proof failed:", error.message);
    process.exitCode = 1;
});
