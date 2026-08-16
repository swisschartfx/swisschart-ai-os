const assert = require("assert");

const TradingDataCapability = require("../Capabilities/tradingDataCapability");
const GeneralTradingAnalysisEngine = require("./generalTradingAnalysisEngine");
const {
    validateAnalysisRequirements,
    validateAnalysisPlan
} = require("./analysisRequirementContract");
const { PeriodResolver } = require("../Time/periodContract");

async function run() {
    const sourceCalls = [];
    const records = [{
        result: "loss", realizedRR: -1, tradeDate: "2026-08-01",
        notionProperty: "must-not-leak"
    }, {
        result: "loss", realizedRR: -0.5, tradeDate: "2026-08-02"
    }, {
        result: "win", realizedRR: 3, tradeDate: "2026-08-03"
    }, {
        result: "loss", realizedRR: -1, tradeDate: "2026-08-04"
    }];
    const clock = () => new Date("2026-08-13T13:00:00.000Z");
    const tradingData = new TradingDataCapability({
        clock,
        tradingDataSource: {
            async execute(request) {
                sourceCalls.push(request);
                return { records };
            }
        }
    });
    const currentMonth = new PeriodResolver({ clock }).resolve({
        contractVersion: "1.0", preset: "this_month",
        timezone: "America/New_York"
    });
    const schema = await tradingData.execute({ operation: "trading.schema.get", input: {} });
    assert.strictEqual(schema.data.schemaVersion, "1.0");
    assert.deepStrictEqual(schema.data.fields.map((field) => field.fieldId),
        ["result", "realizedRR", "tradeDate"]);
    assert.strictEqual(JSON.stringify(schema).includes("Notion"), false);
    assert.strictEqual(JSON.stringify(schema).includes("databaseId"), false);

    const engine = new GeneralTradingAnalysisEngine({
        tradingDataCapability: tradingData
    });
    const profitPlan = plan({
        analysisGoal: "Calculate Profit Factor",
        requiredFields: requirements("realizedRR"),
        steps: [{
            id: "gross_profit", primitive: "sum", field: "realizedRR",
            condition: { operator: "greater_than", value: 0 }
        }, {
            id: "gross_loss", primitive: "sum", field: "realizedRR",
            condition: { operator: "less_than", value: 0 }, absolute: true
        }, {
            id: "profit_factor", primitive: "ratio",
            numeratorStep: "gross_profit", denominatorStep: "gross_loss"
        }],
        resultStep: "profit_factor"
    });
    assert.strictEqual(validateAnalysisPlan(profitPlan).valid, true);
    const profitFactor = await engine.execute(profitPlan);
    assert.strictEqual(profitFactor.status, "completed");
    assert.strictEqual(profitFactor.result, 1.2);
    assert.deepStrictEqual(profitFactor.executionMetadata.primitives,
        ["sum", "sum", "ratio"]);

    const streakPlan = plan({
        analysisGoal: "Find maximum consecutive losses",
        requiredFields: requirements("result"),
        ordering: { field: "tradeDate", direction: "ascending" },
        steps: [{
            id: "max_loss_streak", primitive: "ordered_streak",
            field: "result", equals: "loss"
        }],
        resultStep: "max_loss_streak"
    });
    const streak = await engine.execute(streakPlan);
    assert.strictEqual(streak.result, 2);
    assert.deepStrictEqual(sourceCalls[1], {
        intent: "get_normalized_trades",
        source: "trading_journal",
        period: currentMonth,
        filters: { status: "closed" }
    });

    const callsBeforeMissing = sourceCalls.length;
    const requirementOnlyDrawdown = plan({
        analysisGoal: "Calculate exact maximum drawdown",
        requiredFields: [{
            fieldId: "equityAfterTrade",
            reason: "Exact maximum drawdown requires a chronological equity series",
            suggestedData: "Add canonical equity after each closed trade"
        }],
        ordering: { field: "tradeDate", direction: "ascending" },
        calculationStrategy: null
    });
    assert.strictEqual(validateAnalysisRequirements(requirementOnlyDrawdown).valid,
        true);
    const drawdown = await engine.execute(requirementOnlyDrawdown);
    assert.strictEqual(drawdown.status, "missing_data");
    assert.deepStrictEqual(drawdown.missingFields, [{
        field: "equityAfterTrade",
        reason: "Exact maximum drawdown requires a chronological equity series",
        suggestedData: "Add canonical equity after each closed trade"
    }]);
    assert.strictEqual(drawdown.dataSufficiency.possible, false);
    assert.strictEqual(drawdown.dataSufficiency.approximate, false);
    assert.strictEqual(sourceCalls.length, callsBeforeMissing);

    assert.strictEqual(validateAnalysisRequirements(streakPlan).valid, true);
    assert.strictEqual(validateAnalysisRequirements(plan({
        ordering: { field: "tradeDate", direction: "sideways" }
    })).valid, false);

    let unavailableOrderingRecordQueries = 0;
    const unavailableOrderingEngine = new GeneralTradingAnalysisEngine({
        tradingDataCapability: {
            async execute(request) {
                if (request.operation === "trading.schema.get") {
                    return {
                        data: {
                            schemaVersion: "1.0",
                            fields: [{ fieldId: "result", sortable: false }]
                        }
                    };
                }
                unavailableOrderingRecordQueries += 1;
                throw new Error("Record query must not occur");
            }
        }
    });
    const missingOrdering = await unavailableOrderingEngine.execute(plan({
        requiredFields: requirements("result"),
        ordering: { field: "sequenceDate", direction: "ascending" },
        calculationStrategy: null
    }));
    assert.strictEqual(missingOrdering.status, "missing_data");
    assert.deepStrictEqual(missingOrdering.missingFields, [{
        field: "sequenceDate",
        reason: "This field is required to order records for the requested analysis.",
        suggestedData: "Add canonical sequenceDate to normalized trading data"
    }]);
    assert.strictEqual(unavailableOrderingRecordQueries, 0);

    await assert.rejects(() => engine.execute(plan({ calculationStrategy: null })),
        (error) => error.code === "TRADING_ANALYSIS_PLAN_INVALID");

    assert.strictEqual(validateAnalysisRequirements(plan({
        requiredFields: [{ fieldId: "realizedRR" }],
        calculationStrategy: null
    })).valid, false);

    const invalidPrimitive = plan({
        requiredFields: requirements("realizedRR"),
        steps: [{ id: "unsafe", primitive: "eval", field: "realizedRR" }],
        resultStep: "unsafe"
    });
    assert.strictEqual(validateAnalysisPlan(invalidPrimitive).valid, false);
    await assert.rejects(() => engine.execute(invalidPrimitive),
        (error) => error.code === "TRADING_ANALYSIS_PLAN_INVALID");
    await assert.rejects(() => engine.execute({}),
        (error) => error.code === "TRADING_ANALYSIS_PLAN_INVALID");
    assert.strictEqual(JSON.stringify(profitFactor).includes("notionProperty"), false);

    console.log("General Trading Analysis Engine tests passed");
}

function requirements(...fields) {
    return fields.map((fieldId) => ({
        fieldId,
        reason: `${fieldId} is required for the requested analysis`,
        suggestedData: `Provide normalized ${fieldId}`
    }));
}

function plan(overrides = {}) {
    const steps = overrides.steps || [{
        id: "result", primitive: "sum", field: "realizedRR"
    }];
    const calculationStrategy = Object.hasOwn(overrides, "calculationStrategy")
        ? overrides.calculationStrategy
        : { steps, resultStep: overrides.resultStep || "result" };
    return {
        planVersion: "1.0",
        analysisGoal: "Analyze trading performance",
        requiredFields: requirements("realizedRR"),
        optionalFields: [],
        period: "current_month",
        filters: { status: "closed" },
        ordering: null,
        aggregationRequirements: [],
        calculationStrategy,
        dataSufficiency: { allowApproximation: false },
        ...overrides,
        calculationStrategy
    };
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
