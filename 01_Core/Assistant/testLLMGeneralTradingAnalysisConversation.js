const assert = require("assert");

const SwisschartAssistant = require("./01_assistant");
const LLMRequestUnderstanding = require("./llmRequestUnderstanding");
const LLMAnalysisPlanner = require("./llmAnalysisPlanner");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const CapabilityGateway = require("../../02_Core/Capabilities/capabilityGateway");
const TradingDataCapability = require("../../02_Core/Capabilities/tradingDataCapability");
const TradingAnalyticsCapability = require(
    "../../02_Core/Capabilities/tradingAnalyticsCapability"
);
const GeneralTradingAnalysisCapability = require(
    "../../02_Core/Capabilities/generalTradingAnalysisCapability"
);

async function run() {
    const sourceCalls = [];
    const records = [{ result: "loss", realizedRR: -1, tradeDate: "2026-08-01" },
        { result: "loss", realizedRR: -0.5, tradeDate: "2026-08-02" },
        { result: "win", realizedRR: 3, tradeDate: "2026-08-03" }];
    const tradingData = new TradingDataCapability({
        tradingDataSource: {
            async execute(request) {
                sourceCalls.push(request);
                return { records };
            }
        }
    });
    const general = new GeneralTradingAnalysisCapability({
        tradingDataCapability: tradingData
    });
    const registry = new CapabilityRegistry([
        tradingData,
        new TradingAnalyticsCapability({ tradingDataCapability: tradingData }),
        general
    ]);
    const gatewayCalls = [];
    const gateway = new CapabilityGateway({ registry });
    const observedGateway = {
        async execute(request) {
            gatewayCalls.push(request);
            return gateway.execute(request);
        }
    };

    let plannerProviderRequest;
    const profit = createAssistant({
        question: "Profit factor this month",
        metric: "profit_factor",
        plan: profitFactorPlan(),
        registry,
        tradingData,
        gateway: observedGateway,
        observePlanner() { throw new Error("Fixed metric must not use planner"); }
    });
    const profitResponse = await profit.handle("Profit factor این ماه چقدره؟");
    assert.strictEqual(profitResponse.success, true);
    assert.strictEqual(profitResponse.capabilityResult.data.result.value, 2);
    assert.strictEqual(gatewayCalls[0].capability, "trading.analytics");
    assert.strictEqual(gatewayCalls[0].operation,
        "trading.analytics.calculate");

    const streak = createAssistant({
        question: "Max consecutive losses this month",
        metric: "max_consecutive_losses",
        plan: consecutiveLossesPlan(), registry, tradingData, gateway: observedGateway,
        observePlanner(request) { plannerProviderRequest = request; }
    });
    const streakResponse = await streak.handle(
        "Max consecutive losses این ماه چقدر بوده؟"
    );
    assert.strictEqual(streakResponse.success, true);
    assert.strictEqual(streakResponse.capabilityResult.data.result, 2);
    assert.ok(streakResponse.message.includes("2"));
    const safeContext = JSON.parse(plannerProviderRequest.input);
    assert.deepStrictEqual(safeContext.allowedPrimitives,
        ["sum", "ratio", "ordered_streak"]);
    assert.deepStrictEqual(safeContext.availableFields.map((field) => field.fieldId),
        ["result", "realizedRR", "tradeDate"]);
    assert.strictEqual(JSON.stringify(safeContext).includes("Notion"), false);
    assert.strictEqual(JSON.stringify(safeContext).includes("databaseId"), false);
    assert.strictEqual(JSON.stringify(safeContext).includes("records"), false);
    const fixedAnalytics = registry.get("trading.analytics");
    assert.strictEqual(fixedAnalytics.supportedMetrics.includes(
        "max_consecutive_losses"), false);

    const callsBeforeDrawdown = sourceCalls.length;
    const drawdown = createAssistant({
        question: "Exact max drawdown this month",
        metric: "max_drawdown",
        plan: maxDrawdownPlan(), registry, tradingData, gateway: observedGateway,
        understandingOverrides: {
            mode: "read",
            capabilityCandidate: "trading.data",
            operationCandidate: "trading.performance.summary"
        }
    });
    const drawdownResponse = await drawdown.handle(
        "Max Drawdown دقیق این ماه چقدر بوده؟"
    );
    assert.strictEqual(drawdownResponse.success, true);
    assert.strictEqual(drawdownResponse.capabilityResult.data.status, "missing_data");
    assert.ok(drawdownResponse.message.includes("equityAfterTrade"));
    assert.ok(drawdownResponse.message.includes(
        "Exact drawdown requires a chronological equity series"));
    assert.strictEqual(sourceCalls.length, callsBeforeDrawdown);
    assert.strictEqual(fixedAnalytics.supportedMetrics.includes("max_drawdown"), false);

    await assertPlannerRejected(tradingData, {
        ...profitFactorPlan(), period: "next_year"
    });
    await assertPlannerRejected(tradingData, {
        ...profitFactorPlan(), analysisGoal: "eval(process.env)"
    });
    await assertPlannerRejected(tradingData, { planVersion: "1.0" });

    console.log("LLM General Trading Analysis conversation tests passed");
}

function createAssistant(options) {
    return new SwisschartAssistant({
        capabilityGateway: options.gateway,
        requestUnderstanding: new LLMRequestUnderstanding({
            capabilityRegistry: options.registry,
            provider: provider(understanding(options.question, options.metric,
                options.understandingOverrides))
        }),
        analysisPlanner: new LLMAnalysisPlanner({
            tradingDataCapability: options.tradingData,
            provider: provider(options.plan, options.observePlanner)
        }),
        taskEngine: {}, ruleResolver: {}, notionAgent: { handleRequest() {} },
        telegramPublishingWorkflow: { execute() {} },
        performanceSummaryTelegramWorkflow: { execute() {} }
    });
}

function understanding(question, metric, overrides = {}) {
    return {
        domain: "trading", mode: "analyze", requestedMetric: metric,
        analyticalGoal: question, period: "current_month",
        capabilityCandidate: "trading.general_analysis",
        operationCandidate: "trading.general_analysis.execute",
        calculationRequired: true, confidence: 0.95, originalRequest: question,
        ...overrides
    };
}

function basePlan(goal, requiredFields, steps, resultStep, ordering = null) {
    return {
        planVersion: "1.0", analysisGoal: goal, requiredFields,
        optionalFields: [], period: "current_month", filters: { status: "closed" },
        ordering, aggregationRequirements: [],
        calculationStrategy: { steps, resultStep },
        dataSufficiency: { allowApproximation: false }
    };
}

function required(fieldId, reason = "Required for analysis") {
    return { fieldId, reason, suggestedData: `canonical ${fieldId}` };
}

function profitFactorPlan() {
    return basePlan("Profit Factor", [required("realizedRR")], [{
        id: "profit", primitive: "sum", field: "realizedRR",
        condition: { operator: "greater_than", value: 0 }
    }, {
        id: "loss", primitive: "sum", field: "realizedRR",
        condition: { operator: "less_than", value: 0 }, absolute: true
    }, {
        id: "result", primitive: "ratio",
        numeratorStep: "profit", denominatorStep: "loss"
    }], "result");
}

function consecutiveLossesPlan() {
    return basePlan("Maximum consecutive losses",
        [required("result"), required("tradeDate")], [{
            id: "result", primitive: "ordered_streak", field: "result", equals: "loss"
        }], "result", { field: "tradeDate", direction: "ascending" });
}

function maxDrawdownPlan() {
    return {
        ...basePlan("Exact Max Drawdown", [required("tradeDate"), required(
        "equityAfterTrade", "Exact drawdown requires a chronological equity series"
    )], [{
        id: "result", primitive: "sum", field: "equityAfterTrade"
    }], "result", { field: "tradeDate", direction: "ascending" }),
        calculationStrategy: null
    };
}

function provider(data, observe) {
    return {
        async generateStructured(request) {
            if (observe) observe(request);
            return {
                ok: true, provider: "mock", model: "mock-model", data,
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                metadata: { activity: request.activity }
            };
        }
    };
}

async function assertPlannerRejected(tradingData, output) {
    let dataCalls = 0;
    const planner = new LLMAnalysisPlanner({
        tradingDataCapability: tradingData,
        provider: provider(output, () => { dataCalls += 1; })
    });
    const result = await planner.plan("Unsafe plan test");
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, "ANALYSIS_PLAN_INVALID");
    assert.strictEqual(dataCalls, 1);
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
