const assert = require("assert");

const CapabilityRegistry = require("./capabilityRegistry");
const CapabilityGateway = require("./capabilityGateway");
const TradingDataCapability = require("./tradingDataCapability");
const {
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    createCapabilityRequest,
    validateCapabilityResult
} = require("./capabilityContract");
const { PeriodResolver } = require("../Time/periodContract");

async function run() {
    const sourceRequests = [];
    const expectedSummary = {
        totalTrades: 4,
        closedTrades: 3,
        wins: 2,
        losses: 1,
        breakEven: 0,
        cancelled: 0,
        pending: 1,
        winRate: 2 / 3,
        averageRR: 1,
        netRR: 3
    };
    const clock = () => new Date("2026-08-13T13:00:00.000Z");
    const capability = new TradingDataCapability({
        clock,
        tradingDataSource: {
            async execute(request) {
                sourceRequests.push(request);
                if (request.intent === "get_normalized_trades") {
                    return { records: [] };
                }
                return expectedSummary;
            }
        }
    });

    const currentMonth = new PeriodResolver({ clock }).resolve({
        contractVersion: "1.0", preset: "this_month",
        timezone: "America/New_York"
    });
    assert.strictEqual(capability.name, "trading.data");
    assert.strictEqual(capability.declaration.behavior, CAPABILITY_BEHAVIORS.READ_ONLY);
    assert.strictEqual(capability.declaration.approvalRequirement, APPROVAL_REQUIREMENTS.NONE);
    assert.deepStrictEqual(capability.declaration.supportedOperations, [
        "trading.performance.summary",
        "trading.records.query",
        "trading.schema.get"
    ]);

    const registry = new CapabilityRegistry();
    assert.strictEqual(registry.register(capability), capability);
    assert.strictEqual(registry.get("trading.data"), capability);

    const gateway = new CapabilityGateway({
        registry,
        clock: createClock([
            "2026-08-13T13:00:00.000Z",
            "2026-08-13T13:00:01.000Z"
        ])
    });
    const request = createCapabilityRequest({
        requestId: "trading-summary-request-1",
        capability: "trading.data",
        operation: "trading.performance.summary",
        input: {},
        context: {},
        constraints: { readOnly: true },
        metadata: {},
        requestedBy: "integration-test",
        source: "capability-gateway-test",
        timestamp: "2026-08-13T12:59:59.000Z",
        inputContractVersion: "1.0"
    });

    const result = await gateway.execute(request);

    assert.strictEqual(validateCapabilityResult(result).valid, true);
    assert.strictEqual(result.status, "completed");
    assert.deepStrictEqual(result.data, expectedSummary);
    assert.strictEqual(result.recordCount, 4);
    assert.strictEqual(result.executionMetadata.behavior, "read_only");
    assert.deepStrictEqual(result.sourceReferences, ["trading_journal"]);
    assert.deepStrictEqual(sourceRequests, [{
        intent: "get_performance_summary",
        source: "trading_journal"
    }]);
    assert.strictEqual(Object.hasOwn(request, "databaseId"), false);
    assert.strictEqual(JSON.stringify(result).includes("Notion"), false);

    await capability.execute({
        operation: "trading.performance.summary",
        input: { period: "current_month" }
    });
    assert.deepStrictEqual(sourceRequests[1], {
        intent: "get_performance_summary",
        source: "trading_journal",
        period: currentMonth
    });

    await capability.execute({
        operation: "trading.records.query",
        input: {
            period: "current_month",
            requiredFields: ["result", "realizedRR"],
            filters: { status: "closed" }
        }
    });
    assert.deepStrictEqual(sourceRequests[2], {
        intent: "get_normalized_trades",
        source: "trading_journal",
        period: currentMonth,
        filters: { status: "closed" }
    });

    await assert.rejects(
        () => capability.execute({
            operation: "trading.performance.summary",
            input: { period: "last_year" }
        }),
        (error) => error.code === "TRADING_DATA_PERIOD_UNSUPPORTED"
    );

    await assert.rejects(
        () => capability.execute({ operation: "trading.records.write" }),
        (error) => error.code === "TRADING_DATA_OPERATION_UNSUPPORTED"
    );

    console.log("Trading Data Capability integration test passed");
}

function createClock(timestamps) {
    return () => new Date(timestamps.shift());
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
