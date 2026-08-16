const {
    PLAN_VERSION,
    PRIMITIVES,
    validateAnalysisRequirements
} = require("../../02_Core/Analytics/analysisRequirementContract");

const ANALYSIS_PLAN_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["planVersion", "analysisGoal", "requiredFields", "optionalFields",
        "period", "filters", "ordering", "aggregationRequirements",
        "calculationStrategy", "dataSufficiency"],
    properties: {
        planVersion: { type: "string", enum: [PLAN_VERSION] },
        analysisGoal: { type: "string" },
        requiredFields: {
            type: "array",
            minItems: 1,
            items: {
                type: "object",
                additionalProperties: false,
                required: ["fieldId", "reason", "suggestedData"],
                properties: {
                    fieldId: { type: "string" },
                    reason: { type: "string" },
                    suggestedData: { type: "string" }
                }
            }
        },
        optionalFields: { type: "array", items: { type: "string" } },
        period: { type: "string", enum: ["current_month", "all_time"] },
        filters: {
            type: "object", additionalProperties: false,
            required: ["status"], properties: { status: { type: "string", enum: ["closed"] } }
        },
        ordering: {
            anyOf: [{ type: "null" }, {
                type: "object", additionalProperties: false,
                required: ["field", "direction"],
                properties: {
                    field: { type: "string" },
                    direction: { type: "string", enum: ["ascending", "descending"] }
                }
            }]
        },
        aggregationRequirements: { type: "array", items: { type: "string" } },
        calculationStrategy: {
            anyOf: [{ type: "null" }, {
            type: "object", additionalProperties: false,
            required: ["steps", "resultStep"],
            properties: {
                steps: {
                    type: "array", minItems: 1,
                    items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["id", "primitive", "field", "condition",
                            "numeratorStep", "denominatorStep", "absolute", "equals"],
                        properties: {
                            id: { type: "string" },
                            primitive: { type: "string", enum: [...PRIMITIVES] },
                            field: { anyOf: [{ type: "string" }, { type: "null" }] },
                            condition: {
                                anyOf: [{ type: "null" }, {
                                    type: "object", additionalProperties: false,
                                    required: ["operator", "value"],
                                    properties: {
                                        operator: {
                                            type: "string",
                                            enum: ["greater_than", "less_than", "equals"]
                                        },
                                        value: {
                                            anyOf: [{ type: "number" }, { type: "string" }]
                                        }
                                    }
                                }]
                            },
                            numeratorStep: {
                                anyOf: [{ type: "string" }, { type: "null" }]
                            },
                            denominatorStep: {
                                anyOf: [{ type: "string" }, { type: "null" }]
                            },
                            absolute: {
                                anyOf: [{ type: "boolean" }, { type: "null" }]
                            },
                            equals: {
                                anyOf: [{ type: "string" }, { type: "number" },
                                    { type: "null" }]
                            }
                        }
                    }
                },
                resultStep: { type: "string" }
            }
            }]
        },
        dataSufficiency: {
            type: "object", additionalProperties: false,
            required: ["allowApproximation"],
            properties: { allowApproximation: { type: "boolean", enum: [false] } }
        }
    }
};

class LLMAnalysisPlanner {
    constructor(options = {}) {
        this.provider = options.provider;
        this.tradingDataCapability = options.tradingDataCapability;
    }

    async plan(question) {
        if (!this.provider || typeof this.provider.generateStructured !== "function" ||
            !this.tradingDataCapability ||
            typeof this.tradingDataCapability.execute !== "function") {
            return failure("ANALYSIS_PLANNER_UNAVAILABLE", "Analysis planner is unavailable");
        }
        const schemaResult = await this.tradingDataCapability.execute({
            operation: "trading.schema.get", input: {}
        });
        const safeContext = {
            planVersion: PLAN_VERSION,
            availableFields: schemaResult.data.fields.map((field) => ({
                fieldId: field.fieldId,
                type: field.type,
                semanticMeaning: field.semanticMeaning,
                nullable: field.nullable,
                sortable: field.sortable,
                filterable: field.filterable
            })),
            allowedPrimitives: [...PRIMITIVES],
            founderQuestion: String(question || "")
        };
        const providerResult = await this.provider.generateStructured({
            activity: "assistant.trading_analysis_planning",
            input: JSON.stringify(safeContext),
            schemaName: "trading_analysis_requirement_plan",
            schema: ANALYSIS_PLAN_SCHEMA,
            instructions: "Create only a declarative trading analysis plan. Never return " +
                "code, SQL, shell commands, formulas as executable strings, or invented data. " +
                "Use only allowed primitives. Required canonical fields may include fields not " +
                "currently available so the engine can report missing data. Set " +
                "calculationStrategy to null when any required field is not in availableFields. " +
                "When all required fields are available, provide a declarative strategy."
        });
        if (!providerResult.ok) return failure(providerResult.error.code,
            providerResult.error.message, providerResult.error);
        const validation = validateAnalysisRequirements(providerResult.data);
        if (!validation.valid) {
            return failure("ANALYSIS_PLAN_INVALID", validation.errors.join("; "));
        }
        return {
            ok: true,
            plan: providerResult.data,
            providerMetadata: {
                provider: providerResult.provider,
                model: providerResult.model,
                usage: providerResult.usage,
                request: providerResult.metadata
            }
        };
    }
}

function failure(code, message, providerError) {
    return { ok: false, error: { code, message, providerError: providerError || null } };
}

module.exports = LLMAnalysisPlanner;
module.exports.ANALYSIS_PLAN_SCHEMA = ANALYSIS_PLAN_SCHEMA;
