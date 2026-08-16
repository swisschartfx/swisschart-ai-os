const PLAN_VERSION = "1.0";
const PRIMITIVES = Object.freeze(["sum", "ratio", "ordered_streak"]);
const { validateNormalizedPeriod } = require("../Time/periodContract");
const LEGACY_PERIODS = Object.freeze(["current_month", "all_time"]);

function validateAnalysisRequirements(plan) {
    const errors = [];
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
        return { valid: false, errors: ["analysis plan must be an object"] };
    }
    if (containsExecutableContent(plan)) {
        errors.push("analysis plan contains executable or code-like content");
    }
    if (plan.planVersion !== PLAN_VERSION) errors.push("planVersion is unsupported");
    if (typeof plan.analysisGoal !== "string" || !plan.analysisGoal.trim()) {
        errors.push("analysisGoal is required");
    }
    if (!isSupportedPeriod(plan.period)) errors.push("period is unsupported");
    if (!Array.isArray(plan.requiredFields) || !plan.requiredFields.length) {
        errors.push("requiredFields must be a non-empty array");
    } else {
        for (const requirement of plan.requiredFields) {
            if (!requirement || typeof requirement.fieldId !== "string" ||
                !requirement.fieldId.trim() || typeof requirement.reason !== "string" ||
                !requirement.reason.trim() || typeof requirement.suggestedData !== "string" ||
                !requirement.suggestedData.trim()) {
                errors.push("each required field needs fieldId, reason and suggestedData");
            }
        }
    }
    if (plan.optionalFields !== undefined && !Array.isArray(plan.optionalFields)) {
        errors.push("optionalFields must be an array");
    }
    if (!plan.filters || typeof plan.filters !== "object" ||
        Array.isArray(plan.filters) || plan.filters.status !== "closed" ||
        Object.keys(plan.filters).length !== 1) {
        errors.push("filters must request closed records only");
    }
    if (plan.ordering !== null && plan.ordering !== undefined &&
        (!plan.ordering || typeof plan.ordering.field !== "string" ||
            !plan.ordering.field.trim() ||
            !["ascending", "descending"].includes(plan.ordering.direction))) {
        errors.push("ordering is invalid");
    }
    if (!Array.isArray(plan.aggregationRequirements)) {
        errors.push("aggregationRequirements must be an array");
    }
    return { valid: errors.length === 0, errors };
}

function isSupportedPeriod(period) {
    if (LEGACY_PERIODS.includes(period)) return true;
    try { validateNormalizedPeriod(period); return true; }
    catch (error) { return false; }
}

function validateCalculationStrategy(plan) {
    const requirements = validateAnalysisRequirements(plan);
    if (!requirements.valid) return requirements;
    const errors = [];
    if (!plan.calculationStrategy || !Array.isArray(plan.calculationStrategy.steps) ||
        !plan.calculationStrategy.steps.length ||
        typeof plan.calculationStrategy.resultStep !== "string") {
        errors.push("calculationStrategy is invalid");
    } else {
        const ids = new Set();
        const requiredFieldIds = new Set((plan.requiredFields || [])
            .map((requirement) => requirement && requirement.fieldId));
        for (const step of plan.calculationStrategy.steps) {
            if (!step || typeof step.id !== "string" || !step.id.trim() || ids.has(step.id)) {
                errors.push("calculation steps require unique ids");
                continue;
            }
            if (!PRIMITIVES.includes(step.primitive)) {
                errors.push(`primitive is unsupported: ${step.primitive}`);
            } else if (step.primitive === "sum" &&
                (typeof step.field !== "string" || !step.field.trim())) {
                errors.push("sum requires a field");
            } else if (step.primitive === "ratio" &&
                (typeof step.numeratorStep !== "string" ||
                    typeof step.denominatorStep !== "string")) {
                errors.push("ratio requires numeratorStep and denominatorStep");
            } else if (step.primitive === "ordered_streak" &&
                (typeof step.field !== "string" || !("equals" in step))) {
                errors.push("ordered_streak requires field and equals");
            }
            if (["sum", "ordered_streak"].includes(step.primitive) &&
                !requiredFieldIds.has(step.field)) {
                errors.push("calculation fields must be declared as requiredFields");
            }
            if (step.primitive === "ratio" &&
                (!ids.has(step.numeratorStep) || !ids.has(step.denominatorStep))) {
                errors.push("ratio references must point to earlier calculation steps");
            }
            if (step.condition &&
                (!["greater_than", "less_than", "equals"].includes(
                    step.condition.operator) || !("value" in step.condition))) {
                errors.push("step condition is invalid");
            }
            ids.add(step.id);
        }
        if (!ids.has(plan.calculationStrategy.resultStep)) {
            errors.push("resultStep must reference a calculation step");
        }
    }
    return { valid: errors.length === 0, errors };
}

function validateAnalysisPlan(plan) {
    return validateCalculationStrategy(plan);
}

function containsExecutableContent(value) {
    const text = JSON.stringify(value);
    return /\beval\s*\(|\bnew\s+Function\b|=>|\bjavascript\s*:|\bSELECT\b[\s\S]*\bFROM\b|\brm\s+-|\$\(/i
        .test(text);
}

module.exports = {
    PLAN_VERSION,
    PRIMITIVES,
    validateAnalysisRequirements,
    validateCalculationStrategy,
    validateAnalysisPlan
};
