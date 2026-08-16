const assert = require("assert");

const LLMRequestUnderstanding = require("./llmRequestUnderstanding");
const CurrentMonthPerformanceRequestUnderstanding = require(
    "./currentMonthPerformanceRequestUnderstanding"
);
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const TradingDataCapability = require("../../02_Core/Capabilities/tradingDataCapability");
const TradingAnalyticsCapability = require(
    "../../02_Core/Capabilities/tradingAnalyticsCapability"
);

async function run() {
    const tradingData = new TradingDataCapability({
        tradingDataSource: { execute() {} }
    });
    const registry = new CapabilityRegistry([
        tradingData,
        new TradingAnalyticsCapability({ tradingDataCapability: tradingData })
    ]);

    let providedRequest;

    const known = new LLMRequestUnderstanding({
        provider: providerResult(understanding({ requestedMetric: "win_rate" }),
            (request) => { providedRequest = request; }),
        capabilityRegistry: registry
    });
    const knownResult = await known.understand("Win rate this month چقدره؟");
    assert.strictEqual(knownResult.executable, true);
    assert.strictEqual(knownResult.capabilityRequest.capability, "trading.data");
    assert.strictEqual(knownResult.capabilityRequest.input.period, "current_month");
    assert.ok(providedRequest.instructions.includes('"capabilityId":"trading.analytics"'));
    assert.ok(providedRequest.instructions.includes(
        '"supportedOperations":["trading.analytics.calculate"]'));
    assert.ok(providedRequest.instructions.includes(
        '"supportedMetrics":["profit_factor","average_rr","average_win_rr",' +
        '"average_loss_rr","expectancy_rr","gross_profit_rr","gross_loss_rr"]'));
    assert.strictEqual(providedRequest.instructions.includes("Notion"), false);

    const profitFactor = new LLMRequestUnderstanding({
        provider: providerResult(understanding({
            requestedMetric: "profit_factor",
            analyticalGoal: "Calculate profit factor for current-month trades",
            calculationRequired: true,
            capabilityCandidate: "trading.analytics",
            operationCandidate: "trading.analytics.calculate",
            originalRequest: "Profit factor این ماه چقدره؟"
        })),
        capabilityRegistry: registry
    });
    const profitResult = await profitFactor.understand(
        "Profit factor این ماه چقدره؟"
    );
    assert.strictEqual(profitResult.understanding.requestedMetric, "profit_factor");
    assert.strictEqual(profitResult.understanding.calculationRequired, true);
    assert.strictEqual(profitResult.executable, true);
    assert.strictEqual(profitResult.generalAnalysisEligible, false);
    assert.strictEqual(profitResult.capabilityRequest.capability, "trading.analytics");
    assert.strictEqual(profitResult.capabilityRequest.operation,
        "trading.analytics.calculate");
    assert.strictEqual(profitResult.capabilityRequest.input.requestedMetric,
        "profit_factor");

    const imperfectFixedHint = new LLMRequestUnderstanding({
        provider: providerResult(understanding({
            requestedMetric: "profit_factor",
            calculationRequired: true,
            capabilityCandidate: "invented.capability",
            operationCandidate: "invented.execute"
        })),
        capabilityRegistry: registry
    });
    const resolvedFixed = await imperfectFixedHint.understand("Profit factor");
    assert.strictEqual(resolvedFixed.executable, true);
    assert.strictEqual(resolvedFixed.generalAnalysisEligible, false);
    assert.strictEqual(resolvedFixed.capabilityRequest.capability, "trading.analytics");
    assert.strictEqual(resolvedFixed.capabilityRequest.operation,
        "trading.analytics.calculate");

    const unknownCapability = new LLMRequestUnderstanding({
        provider: providerResult(understanding({
            capabilityCandidate: "invented.capability",
            operationCandidate: "invented.execute"
        })),
        capabilityRegistry: registry
    });
    const unknownResult = await unknownCapability.understand("Analyze this");
    assert.strictEqual(unknownResult.executable, false);
    assert.strictEqual(unknownResult.unsupportedReason,
        "capability_or_operation_not_registered");
    assert.strictEqual(unknownResult.capabilityRequest, null);
    assert.strictEqual(unknownResult.generalAnalysisEligible, false);

    const unknownOperation = new LLMRequestUnderstanding({
        provider: providerResult(understanding({
            requestedMetric: "profit_factor",
            calculationRequired: true,
            capabilityCandidate: "trading.analytics",
            operationCandidate: "trading.analytics.invented"
        })),
        capabilityRegistry: registry
    });
    const unknownOperationResult = await unknownOperation.understand("Analyze this");
    assert.strictEqual(unknownOperationResult.executable, true);
    assert.strictEqual(unknownOperationResult.unsupportedReason, null);
    assert.strictEqual(unknownOperationResult.generalAnalysisEligible, false);
    assert.strictEqual(unknownOperationResult.capabilityRequest.operation,
        "trading.analytics.calculate");

    const unsupportedMetric = new LLMRequestUnderstanding({
        provider: providerResult(understanding({
            requestedMetric: "invented_ratio",
            calculationRequired: true,
            capabilityCandidate: "trading.analytics",
            operationCandidate: "trading.analytics.calculate"
        })),
        capabilityRegistry: registry
    });
    const unsupportedMetricResult = await unsupportedMetric.understand("Analyze this");
    assert.strictEqual(unsupportedMetricResult.executable, false);
    assert.strictEqual(unsupportedMetricResult.unsupportedReason,
        "analytical_metric_not_supported");
    assert.strictEqual(unsupportedMetricResult.generalAnalysisEligible, true);

    const readModeMetric = new LLMRequestUnderstanding({
        provider: providerResult(understanding({
            mode: "read",
            requestedMetric: "max_drawdown",
            calculationRequired: true,
            capabilityCandidate: "trading.data",
            operationCandidate: "trading.performance.summary"
        })),
        capabilityRegistry: registry
    });
    const readModeResult = await readModeMetric.understand("Exact max drawdown");
    assert.strictEqual(readModeResult.executable, false);
    assert.strictEqual(readModeResult.generalAnalysisEligible, true);

    const nonTradingMetric = new LLMRequestUnderstanding({
        provider: providerResult(understanding({
            domain: "finance",
            requestedMetric: "invented_ratio",
            calculationRequired: true,
            capabilityCandidate: "trading.analytics",
            operationCandidate: "trading.analytics.calculate"
        })),
        capabilityRegistry: registry
    });
    const nonTradingResult = await nonTradingMetric.understand("Analyze finance");
    assert.strictEqual(nonTradingResult.executable, false);
    assert.strictEqual(nonTradingResult.generalAnalysisEligible, false);

    const fallback = new LLMRequestUnderstanding({
        provider: providerResult({ domain: "trading" }),
        capabilityRegistry: registry,
        fallback: new CurrentMonthPerformanceRequestUnderstanding({
            idGenerator: () => "fallback-request",
            clock: () => new Date("2026-08-13T18:00:00.000Z")
        })
    });
    const fallbackResult = await fallback.understand(
        "Win rate this month چقدره؟"
    );
    assert.strictEqual(fallbackResult.requestedMetrics, "win_rate");
    assert.strictEqual(fallbackResult.capabilityRequest.requestId, "fallback-request");
    assert.strictEqual(fallbackResult.llmError.code, "REQUEST_UNDERSTANDING_INVALID");

    console.log("LLM Request Understanding mock tests passed");
}

function understanding(overrides = {}) {
    return {
        domain: "trading",
        mode: "analyze",
        requestedMetric: "general",
        analyticalGoal: "Summarize current-month trading performance",
        period: "current_month",
        capabilityCandidate: "trading.data",
        operationCandidate: "trading.performance.summary",
        calculationRequired: false,
        confidence: 0.95,
        originalRequest: "Performance this month",
        ...overrides
    };
}

function providerResult(data, observeRequest) {
    return {
        async generateStructured(request) {
            if (observeRequest) observeRequest(request);
            return {
                ok: true,
                provider: "openai",
                model: "mock-model",
                data,
                usage: {
                    inputTokens: 12,
                    outputTokens: 8,
                    totalTokens: 20,
                    cachedInputTokens: 0
                },
                metadata: {
                    providerRequestId: "mock-response-1",
                    activity: "assistant.request_understanding",
                    status: "completed"
                }
            };
        }
    };
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
