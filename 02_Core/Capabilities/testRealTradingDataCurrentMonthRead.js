const assert = require("assert");
const path = require("path");
const dotenv = require("../../02_Agents/01_Journal_Agent/node_modules/dotenv");

const CapabilityRegistry = require("./capabilityRegistry");
const CapabilityGateway = require("./capabilityGateway");
const TradingDataCapability = require("./tradingDataCapability");
const { createCapabilityRequest, validateCapabilityResult } = require("./capabilityContract");

dotenv.config({ path: path.join(__dirname, "../../.env"), override: true, quiet: true });

async function run() {
    if (!process.env.NOTION_API_TOKEN || !process.env.NOTION_DATABASE_ID) {
        throw new Error("NOTION_API_TOKEN and NOTION_DATABASE_ID are required");
    }

    const gateway = new CapabilityGateway({
        registry: new CapabilityRegistry([new TradingDataCapability()])
    });
    const result = await gateway.execute(createCapabilityRequest({
        capability: "trading.data",
        operation: "trading.performance.summary",
        input: { period: "current_month" },
        context: {},
        constraints: { readOnly: true },
        metadata: {},
        requestedBy: "founder-proof",
        source: "real-current-month-read-proof",
        inputContractVersion: "1.0"
    }));

    assert.strictEqual(validateCapabilityResult(result).valid, true);
    assert.strictEqual(result.status, "completed");
    assert.strictEqual(result.executionMetadata.period, "current_month");
    assert.ok(Number.isInteger(result.data.totalTrades));
    assert.ok(result.data.totalTrades >= 0);
    assert.ok(Number.isFinite(result.data.winRate));
    console.log(result);
    console.log("Real current-month Trading Data read proof passed");
}

run().catch((error) => {
    console.error("Real current-month Trading Data read proof failed:", error.message);
    process.exitCode = 1;
});
