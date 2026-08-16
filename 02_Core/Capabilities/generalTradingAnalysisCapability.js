const GeneralTradingAnalysisEngine = require("../Analytics/generalTradingAnalysisEngine");
const {
    EXECUTION_MODES,
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    LIFECYCLE_STAGES,
    createCapabilityDeclaration
} = require("./capabilityContract");
const { PeriodResolver, resolvePeriodInput } = require("../Time/periodContract");

const GENERAL_ANALYSIS_EXECUTE = "trading.general_analysis.execute";

class GeneralTradingAnalysisCapability {
    constructor(options = {}) {
        this.name = "trading.general_analysis";
        this.periodResolver = options.periodResolver || new PeriodResolver({
            clock: options.clock
        });
        this.engine = options.engine || new GeneralTradingAnalysisEngine({
            tradingDataCapability: options.tradingDataCapability
        });
        this.declaration = createCapabilityDeclaration({
            capabilityId: this.name,
            domain: "trading",
            version: "1.0.0",
            supportedOperations: [GENERAL_ANALYSIS_EXECUTE],
            executionMode: EXECUTION_MODES.SYNCHRONOUS,
            behavior: CAPABILITY_BEHAVIORS.READ_ONLY,
            approvalRequirement: APPROVAL_REQUIREMENTS.NONE,
            lifecycleSupport: [LIFECYCLE_STAGES.ANALYZE],
            inputContractVersion: "1.0",
            outputContractVersion: "1.0"
        });
    }

    async execute(request) {
        if (!request || request.operation !== GENERAL_ANALYSIS_EXECUTE) {
            const error = new Error("General trading analysis operation is unsupported");
            error.code = "GENERAL_TRADING_ANALYSIS_OPERATION_UNSUPPORTED";
            throw error;
        }
        const sourcePlan = request.input && request.input.plan;
        const plan = sourcePlan && sourcePlan.period !== "all_time"
            ? { ...sourcePlan, period: resolvePeriodInput(
                sourcePlan.period, this.periodResolver) }
            : sourcePlan;
        const analysis = await this.engine.execute(plan);
        if (sourcePlan && typeof sourcePlan.period === "string") {
            analysis.period = sourcePlan.period;
        }
        return {
            data: analysis,
            summary: analysis.status === "missing_data"
                ? "Trading analysis requires unavailable data"
                : "General trading analysis completed",
            evidence: [],
            sourceReferences: ["trading_data"],
            recordCount: analysis.recordCount,
            executionMetadata: { engine: "general_trading_analysis", aiUsage: null }
        };
    }
}

module.exports = GeneralTradingAnalysisCapability;
module.exports.GENERAL_ANALYSIS_EXECUTE = GENERAL_ANALYSIS_EXECUTE;
