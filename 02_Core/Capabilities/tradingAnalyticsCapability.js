const {
    EXECUTION_MODES,
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    LIFECYCLE_STAGES,
    createCapabilityDeclaration
} = require("./capabilityContract");

const ANALYTICS_CALCULATE = "trading.analytics.calculate";
const REALIZED_RR_FIELDS = Object.freeze(["result", "realizedRR"]);
const METRICS = Object.freeze({
    profit_factor: {
        requiredFields: REALIZED_RR_FIELDS,
        calculate(records) {
            const values = realizedRRValues(records);
            const grossProfit = sumPositive(values);
            const grossLoss = sumAbsoluteNegative(values);
            if (grossLoss === 0) {
                throw analyticsError("TRADING_ANALYTICS_ZERO_GROSS_LOSS",
                    "Profit Factor is undefined when gross loss is zero");
            }
            return {
                metric: "profit_factor",
                value: grossProfit / grossLoss,
                components: { grossProfit, grossLoss },
                unit: "ratio"
            };
        }
    },
    average_rr: realizedRRMetric("average_rr", (values) =>
        sum(values) / values.length),
    average_win_rr: realizedRRMetric("average_win_rr", (values) => {
        const wins = values.filter((value) => value > 0);
        if (!wins.length) {
            throw analyticsError("TRADING_ANALYTICS_NO_WINNING_TRADES",
                "Average win RR is undefined without winning trades");
        }
        return sum(wins) / wins.length;
    }),
    average_loss_rr: realizedRRMetric("average_loss_rr", (values) => {
        const losses = values.filter((value) => value < 0);
        if (!losses.length) {
            throw analyticsError("TRADING_ANALYTICS_NO_LOSING_TRADES",
                "Average loss RR is undefined without losing trades");
        }
        return sumAbsoluteNegative(losses) / losses.length;
    }),
    expectancy_rr: realizedRRMetric("expectancy_rr", (values) =>
        sum(values) / values.length),
    gross_profit_rr: realizedRRMetric("gross_profit_rr", sumPositive),
    gross_loss_rr: realizedRRMetric("gross_loss_rr", sumAbsoluteNegative)
});

function realizedRRMetric(metric, calculate) {
    return {
        requiredFields: REALIZED_RR_FIELDS,
        calculate(records) {
            return {
                metric,
                value: calculate(realizedRRValues(records)),
                unit: "rr"
            };
        }
    };
}

function realizedRRValues(records) {
    if (!Array.isArray(records) || !records.length || records.some((record) =>
        !Number.isFinite(record.realizedRR))) {
        throw analyticsError("TRADING_ANALYTICS_INSUFFICIENT_DATA",
            "Realized RR is required for every selected trade");
    }
    return records.map((record) => record.realizedRR);
}

function sum(values) {
    return values.reduce((total, value) => total + value, 0);
}

function sumPositive(values) {
    return values.reduce((total, value) => total + Math.max(value, 0), 0);
}

function sumAbsoluteNegative(values) {
    return Math.abs(values.reduce((total, value) => total + Math.min(value, 0), 0));
}

class TradingAnalyticsCapability {
    constructor(options = {}) {
        this.name = "trading.analytics";
        this.supportedMetrics = Object.freeze(Object.keys(METRICS));
        this.tradingDataCapability = options.tradingDataCapability;
        if (!this.tradingDataCapability ||
            typeof this.tradingDataCapability.execute !== "function") {
            throw analyticsError("TRADING_ANALYTICS_DATA_CAPABILITY_REQUIRED",
                "Trading Analytics requires Trading Data Capability");
        }
        this.declaration = createCapabilityDeclaration({
            capabilityId: this.name,
            domain: "trading",
            version: "1.0.0",
            supportedOperations: [ANALYTICS_CALCULATE],
            executionMode: EXECUTION_MODES.SYNCHRONOUS,
            behavior: CAPABILITY_BEHAVIORS.READ_ONLY,
            approvalRequirement: APPROVAL_REQUIREMENTS.NONE,
            lifecycleSupport: [LIFECYCLE_STAGES.ANALYZE],
            inputContractVersion: "1.0",
            outputContractVersion: "1.0"
        });
    }

    async execute(request) {
        if (!request || request.operation !== ANALYTICS_CALCULATE) {
            throw analyticsError("TRADING_ANALYTICS_OPERATION_UNSUPPORTED",
                "Trading analytics operation is unsupported");
        }
        const metric = request.input && request.input.requestedMetric;
        const definition = METRICS[metric];
        if (!definition) {
            throw analyticsError("TRADING_ANALYTICS_METRIC_UNSUPPORTED",
                "Requested analytical metric is unsupported");
        }
        const dataResult = await this.tradingDataCapability.execute({
            operation: "trading.records.query",
            input: {
                period: request.input.period,
                requiredFields: definition.requiredFields,
                filters: request.input.filters || {}
            }
        });
        const analyticalResult = definition.calculate(dataResult.data.records);
        return {
            data: {
                analyticalGoal: request.input.analyticalGoal,
                period: request.input.period,
                result: analyticalResult
            },
            summary: "Trading analytical result calculated",
            evidence: [],
            sourceReferences: dataResult.sourceReferences,
            recordCount: dataResult.recordCount,
            executionMetadata: {
                analyticsVersion: this.declaration.version,
                aiUsage: null
            }
        };
    }
}

function analyticsError(code, message) {
    const error = new Error(message);
    error.code = code;
    error.retryable = false;
    return error;
}

module.exports = TradingAnalyticsCapability;
module.exports.ANALYTICS_CALCULATE = ANALYTICS_CALCULATE;
