const assert = require("assert");

const CapabilityRegistry = require("./capabilityRegistry");
const CapabilityGateway = require("./capabilityGateway");
const TradingAnalyticsCapability = require("./tradingAnalyticsCapability");
const { createCapabilityRequest } = require("./capabilityContract");

async function run() {
    const dataRequests = [];
    const analytics = new TradingAnalyticsCapability({
        tradingDataCapability: dataCapability([
            { result: "win", realizedRR: 2 },
            { result: "win", realizedRR: 1 },
            { result: "loss", realizedRR: -1 },
            { result: "loss", realizedRR: -0.5 }
        ], dataRequests)
    });
    const gateway = new CapabilityGateway({
        registry: new CapabilityRegistry([analytics])
    });
    const result = await gateway.execute(request("profit_factor"));

    assert.strictEqual(result.status, "completed");
    assert.strictEqual(result.data.result.value, 2);
    assert.deepStrictEqual(result.data.result.components, {
        grossProfit: 3,
        grossLoss: 1.5
    });
    assert.strictEqual(result.data.period, "current_month");
    assert.deepStrictEqual(dataRequests, [{
        operation: "trading.records.query",
        input: {
            period: "current_month",
            requiredFields: ["result", "realizedRR"],
            filters: { status: "closed" }
        }
    }]);
    assert.strictEqual(JSON.stringify(result).includes("Notion"), false);
    assert.strictEqual(JSON.stringify(result).includes("databaseId"), false);
    assert.strictEqual(result.executionMetadata.aiUsage, null);

    assert.deepStrictEqual(analytics.supportedMetrics, [
        "profit_factor",
        "average_rr",
        "average_win_rr",
        "average_loss_rr",
        "expectancy_rr",
        "gross_profit_rr",
        "gross_loss_rr"
    ]);

    const expectedMetrics = {
        gross_profit_rr: 3,
        gross_loss_rr: 1.5,
        average_rr: 0.375,
        average_win_rr: 1.5,
        average_loss_rr: 0.75,
        expectancy_rr: 0.375
    };
    for (const [metric, expectedValue] of Object.entries(expectedMetrics)) {
        const metricResult = await analytics.execute(rawRequest(metric));
        assert.strictEqual(metricResult.data.result.metric, metric);
        assert.strictEqual(metricResult.data.result.value, expectedValue);
        assert.strictEqual(metricResult.data.result.unit, "rr");
    }

    const zeroLoss = new TradingAnalyticsCapability({
        tradingDataCapability: dataCapability([{ result: "win", realizedRR: 2 }])
    });
    await assert.rejects(
        () => zeroLoss.execute(rawRequest("profit_factor")),
        (error) => error.code === "TRADING_ANALYTICS_ZERO_GROSS_LOSS"
    );

    const insufficient = new TradingAnalyticsCapability({
        tradingDataCapability: dataCapability([{ result: "win", realizedRR: null }])
    });
    await assert.rejects(
        () => insufficient.execute(rawRequest("profit_factor")),
        (error) => error.code === "TRADING_ANALYTICS_INSUFFICIENT_DATA"
    );

    const noWins = new TradingAnalyticsCapability({
        tradingDataCapability: dataCapability([{ result: "loss", realizedRR: -1 }])
    });
    await assert.rejects(
        () => noWins.execute(rawRequest("average_win_rr")),
        (error) => error.code === "TRADING_ANALYTICS_NO_WINNING_TRADES"
    );

    const noLosses = new TradingAnalyticsCapability({
        tradingDataCapability: dataCapability([{ result: "win", realizedRR: 1 }])
    });
    await assert.rejects(
        () => noLosses.execute(rawRequest("average_loss_rr")),
        (error) => error.code === "TRADING_ANALYTICS_NO_LOSING_TRADES"
    );

    const noTrades = new TradingAnalyticsCapability({
        tradingDataCapability: dataCapability([])
    });
    await assert.rejects(
        () => noTrades.execute(rawRequest("average_rr")),
        (error) => error.code === "TRADING_ANALYTICS_INSUFFICIENT_DATA"
    );

    await assert.rejects(
        () => analytics.execute(rawRequest("unknown_metric")),
        (error) => error.code === "TRADING_ANALYTICS_METRIC_UNSUPPORTED"
    );

    console.log("Trading Analytics Capability tests passed");
}

function dataCapability(records, calls = []) {
    return {
        async execute(request) {
            calls.push(request);
            return {
                data: { records },
                sourceReferences: ["trading_journal"],
                recordCount: records.length
            };
        }
    };
}

function rawRequest(metric) {
    return {
        operation: "trading.analytics.calculate",
        input: {
            requestedMetric: metric,
            analyticalGoal: "Calculate requested trading metric",
            period: "current_month",
            filters: { status: "closed" }
        }
    };
}

function request(metric) {
    return createCapabilityRequest({
        capability: "trading.analytics",
        operation: "trading.analytics.calculate",
        input: rawRequest(metric).input,
        context: {},
        constraints: { readOnly: true },
        metadata: {},
        requestedBy: "analytics-test",
        source: "unit-test",
        inputContractVersion: "1.0"
    });
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
