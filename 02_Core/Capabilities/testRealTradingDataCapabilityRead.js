const assert = require("assert");
const path = require("path");
const dotenv = require("../../02_Agents/01_Journal_Agent/node_modules/dotenv");

const CapabilityRegistry = require("./capabilityRegistry");
const CapabilityGateway = require("./capabilityGateway");
const TradingDataCapability = require("./tradingDataCapability");
const { createCapabilityRequest, validateCapabilityResult } = require("./capabilityContract");

dotenv.config({
    path: path.join(__dirname, "../../.env"),
    override: true,
    quiet: true
});

async function run() {
    if (!process.env.NOTION_API_TOKEN) {
        throw new Error("NOTION_API_TOKEN is required");
    }
    if (!process.env.NOTION_DATABASE_ID) {
        throw new Error("NOTION_DATABASE_ID is required");
    }

    const registry = new CapabilityRegistry();
    registry.register(new TradingDataCapability());
    const gateway = new CapabilityGateway({ registry });
    const result = await gateway.execute(createCapabilityRequest({
        capability: "trading.data",
        operation: "trading.performance.summary",
        input: {},
        context: {},
        constraints: { readOnly: true },
        metadata: {},
        requestedBy: "founder-proof",
        source: "real-read-proof",
        inputContractVersion: "1.0"
    }));

    assert.strictEqual(validateCapabilityResult(result).valid, true);
    assert.strictEqual(result.status, "completed");
    assert.ok(Number.isInteger(result.data.totalTrades));
    assert.ok(result.data.totalTrades >= 0);
    assert.strictEqual(result.recordCount, result.data.totalTrades);
    assert.strictEqual(result.executionMetadata.behavior, "read_only");
    assert.strictEqual(Object.hasOwn(result, "databaseId"), false);

    console.log(result);
    console.log("Real Trading Data Capability read proof passed");
}

run().catch((error) => {
    console.error("Real Trading Data Capability read proof failed:", error.message);
    process.exitCode = 1;
});
