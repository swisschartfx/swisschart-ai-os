const assert = require("assert");

const SwisschartAssistant = require("./01_assistant");
const LLMRequestUnderstanding = require("./llmRequestUnderstanding");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const CapabilityGateway = require("../../02_Core/Capabilities/capabilityGateway");
const TradingDataCapability = require("../../02_Core/Capabilities/tradingDataCapability");
const TradingAnalyticsCapability = require(
    "../../02_Core/Capabilities/tradingAnalyticsCapability"
);

async function run() {
    const sourceCalls = [];
    const gatewayCalls = [];
    const tradingData = new TradingDataCapability({
        tradingDataSource: {
            async execute(request) {
                sourceCalls.push(request);
                return {
                    records: [
                        { result: "win", realizedRR: 2 },
                        { result: "win", realizedRR: 1 },
                        { result: "loss", realizedRR: -1.5 }
                    ]
                };
            }
        }
    });
    const registry = new CapabilityRegistry([
        tradingData,
        new TradingAnalyticsCapability({ tradingDataCapability: tradingData })
    ]);
    const gateway = new CapabilityGateway({ registry });
    const observedGateway = {
        async execute(request) {
            gatewayCalls.push(request);
            return gateway.execute(request);
        }
    };
    const assistant = createAssistant(observedGateway, registry,
        understanding("profit_factor"));

    const response = await assistant.handle("Profit factor این ماه چقدره؟");

    assert.strictEqual(response.success, true);
    assert.strictEqual(response.message, "Profit Factor this month: 2.");
    assert.strictEqual(gatewayCalls.length, 1);
    assert.strictEqual(gatewayCalls[0].capability, "trading.analytics");
    assert.strictEqual(gatewayCalls[0].operation, "trading.analytics.calculate");
    assert.strictEqual(gatewayCalls[0].input.requestedMetric, "profit_factor");
    assert.strictEqual(gatewayCalls[0].input.period, "current_month");
    assert.strictEqual(sourceCalls.length, 1);
    assert.strictEqual(sourceCalls[0].intent, "get_normalized_trades");
    assert.strictEqual(sourceCalls[0].source, "trading_journal");
    assert.strictEqual(sourceCalls[0].period.timezone, "America/New_York");
    assert.strictEqual(sourceCalls[0].period.contractVersion, "1.0");
    assert.deepStrictEqual(sourceCalls[0].filters, { status: "closed" });
    assert.strictEqual(JSON.stringify(response).includes("Notion"), false);
    assert.strictEqual(JSON.stringify(response).includes("databaseId"), false);

    const unsupportedGatewayCalls = [];
    const unsupported = createAssistant({
        async execute(request) {
            unsupportedGatewayCalls.push(request);
        }
    }, registry, understanding("sharpe_ratio"));
    const unsupportedResponse = await unsupported.handle("Unknown analysis request");
    assert.strictEqual(unsupportedResponse.success, false);
    assert.strictEqual(unsupportedResponse.unsupportedReason,
        "analytical_metric_not_supported");
    assert.strictEqual(unsupportedGatewayCalls.length, 0);

    const inventedGatewayCalls = [];
    const invented = createAssistant({
        async execute(request) {
            inventedGatewayCalls.push(request);
            return gateway.execute(request);
        }
    }, registry, understanding("profit_factor", {
        capabilityCandidate: "invented.analytics",
        operationCandidate: "invented.execute"
    }));
    const inventedResponse = await invented.handle("Invented capability request");
    assert.strictEqual(inventedResponse.success, true);
    assert.strictEqual(inventedGatewayCalls.length, 1);
    assert.strictEqual(inventedGatewayCalls[0].capability, "trading.analytics");
    assert.strictEqual(inventedGatewayCalls[0].operation,
        "trading.analytics.calculate");
    assert.strictEqual(JSON.stringify(inventedGatewayCalls).includes(
        "invented.analytics"), false);
    assert.strictEqual(JSON.stringify(inventedGatewayCalls).includes(
        "invented.execute"), false);

    console.log("LLM Trading Analytics conversation test passed");
}

function createAssistant(capabilityGateway, registry, data) {
    return new SwisschartAssistant({
        capabilityGateway,
        requestUnderstanding: new LLMRequestUnderstanding({
            capabilityRegistry: registry,
            provider: {
                async generateStructured() {
                    return {
                        ok: true,
                        provider: "mock",
                        model: "mock-model",
                        data,
                        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                        metadata: { activity: "assistant.request_understanding" }
                    };
                }
            }
        }),
        taskEngine: {},
        ruleResolver: {},
        notionAgent: { handleRequest() {} },
        telegramPublishingWorkflow: { execute() {} },
        performanceSummaryTelegramWorkflow: { execute() {} }
    });
}

function understanding(metric, overrides = {}) {
    return {
        domain: "trading",
        mode: "analyze",
        requestedMetric: metric,
        analyticalGoal: "Calculate the requested current-month metric",
        period: "current_month",
        capabilityCandidate: "trading.analytics",
        operationCandidate: "trading.analytics.calculate",
        calculationRequired: true,
        confidence: 0.95,
        originalRequest: "Founder analytical request",
        ...overrides
    };
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
