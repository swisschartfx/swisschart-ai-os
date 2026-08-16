const {
    validateAnalysisRequirements,
    validateCalculationStrategy
} = require("./analysisRequirementContract");

class GeneralTradingAnalysisEngine {
    constructor(options = {}) {
        this.tradingDataCapability = options.tradingDataCapability;
        if (!this.tradingDataCapability ||
            typeof this.tradingDataCapability.execute !== "function") {
            throw analysisError("TRADING_ANALYSIS_DATA_CAPABILITY_REQUIRED",
                "General Trading Analysis requires Trading Data Capability");
        }
    }

    async execute(plan) {
        const validation = validateAnalysisRequirements(plan);
        if (!validation.valid) {
            throw analysisError("TRADING_ANALYSIS_PLAN_INVALID",
                validation.errors.join("; "));
        }
        const schemaResult = await this.tradingDataCapability.execute({
            operation: "trading.schema.get",
            input: {}
        });
        const fields = new Map(schemaResult.data.fields.map((field) =>
            [field.fieldId, field]));
        const effectiveRequiredFields = createEffectiveRequiredFields(plan);
        const missingFields = effectiveRequiredFields
            .filter((requirement) => !fields.has(requirement.fieldId))
            .map((requirement) => ({
                field: requirement.fieldId,
                reason: requirement.reason,
                suggestedData: requirement.suggestedData
            }));
        if (missingFields.length) {
            return {
                status: "missing_data",
                analysisGoal: plan.analysisGoal,
                period: plan.period,
                missingFields,
                dataSufficiency: {
                    possible: false,
                    approximate: false,
                    reason: "Required normalized trading data is unavailable"
                },
                schemaVersion: schemaResult.data.schemaVersion
            };
        }

        const calculationValidation = validateCalculationStrategy(plan);
        if (!calculationValidation.valid) {
            throw analysisError("TRADING_ANALYSIS_PLAN_INVALID",
                calculationValidation.errors.join("; "));
        }

        validateOrdering(plan, fields);
        const requiredFieldIds = effectiveRequiredFields.map((item) => item.fieldId);
        const dataResult = await this.tradingDataCapability.execute({
            operation: "trading.records.query",
            input: {
                ...(plan.period && plan.period !== "all_time"
                    ? { period: plan.period } : {}),
                requiredFields: requiredFieldIds,
                filters: plan.filters,
                ...(plan.ordering ? { ordering: plan.ordering } : {})
            }
        });
        if (!dataResult.data.records.length) {
            throw analysisError("TRADING_ANALYSIS_INSUFFICIENT_DATA",
                "No records satisfy the analysis requirements");
        }
        const values = executeSteps(plan.calculationStrategy.steps,
            dataResult.data.records, plan.ordering);
        return {
            status: "completed",
            analysisGoal: plan.analysisGoal,
            period: plan.period,
            result: values.get(plan.calculationStrategy.resultStep),
            recordCount: dataResult.recordCount,
            schemaVersion: schemaResult.data.schemaVersion,
            executionMetadata: { primitives: plan.calculationStrategy.steps.map((s) => s.primitive) }
        };
    }
}

function createEffectiveRequiredFields(plan) {
    const requirements = new Map(plan.requiredFields.map((requirement) =>
        [requirement.fieldId, requirement]));
    if (plan.ordering && !requirements.has(plan.ordering.field)) {
        requirements.set(plan.ordering.field, {
            fieldId: plan.ordering.field,
            reason: "This field is required to order records for the requested analysis.",
            suggestedData: `Add canonical ${plan.ordering.field} to normalized trading data`
        });
    }
    return Array.from(requirements.values());
}

function validateOrdering(plan, fields) {
    if (!plan.ordering) return;
    const field = fields.get(plan.ordering.field);
    if (!field || field.sortable !== true ||
        !["ascending", "descending"].includes(plan.ordering.direction)) {
        throw analysisError("TRADING_ANALYSIS_ORDERING_INVALID",
            "Analysis ordering is unavailable or invalid");
    }
}

function executeSteps(steps, sourceRecords, ordering) {
    const records = orderRecords(sourceRecords, ordering);
    const values = new Map();
    for (const step of steps) {
        if (step.primitive === "sum") {
            let selected = records;
            if (step.condition) selected = selected.filter((record) =>
                compare(record[step.field], step.condition));
            const numbers = selected.map((record) => record[step.field]);
            if (numbers.some((value) => !Number.isFinite(value))) {
                throw analysisError("TRADING_ANALYSIS_INSUFFICIENT_DATA",
                    `Numeric field is missing: ${step.field}`);
            }
            const total = numbers.reduce((sum, value) => sum + value, 0);
            values.set(step.id, step.absolute ? Math.abs(total) : total);
        } else if (step.primitive === "ratio") {
            const numerator = values.get(step.numeratorStep);
            const denominator = values.get(step.denominatorStep);
            if (!Number.isFinite(numerator) || !Number.isFinite(denominator) ||
                denominator === 0) {
                throw analysisError("TRADING_ANALYSIS_RATIO_UNDEFINED",
                    "Ratio requires finite values and a non-zero denominator");
            }
            values.set(step.id, numerator / denominator);
        } else if (step.primitive === "ordered_streak") {
            let longest = 0;
            let current = 0;
            for (const record of records) {
                current = record[step.field] === step.equals ? current + 1 : 0;
                longest = Math.max(longest, current);
            }
            values.set(step.id, longest);
        } else {
            throw analysisError("TRADING_ANALYSIS_PRIMITIVE_UNSUPPORTED",
                `Unsupported primitive: ${step.primitive}`);
        }
    }
    return values;
}

function compare(value, condition) {
    if (condition.operator === "greater_than") return value > condition.value;
    if (condition.operator === "less_than") return value < condition.value;
    if (condition.operator === "equals") return value === condition.value;
    throw analysisError("TRADING_ANALYSIS_CONDITION_UNSUPPORTED",
        `Unsupported condition: ${condition.operator}`);
}

function orderRecords(records, ordering) {
    if (!ordering) return [...records];
    const direction = ordering.direction === "descending" ? -1 : 1;
    return [...records].sort((left, right) =>
        String(left[ordering.field]).localeCompare(String(right[ordering.field])) * direction);
}

function analysisError(code, message) {
    const error = new Error(message);
    error.code = code;
    error.retryable = false;
    return error;
}

module.exports = GeneralTradingAnalysisEngine;
