const NotionCapability = require("./notionCapability");
const {
    EXECUTION_MODES,
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    LIFECYCLE_STAGES,
    createCapabilityDeclaration
} = require("./capabilityContract");
const { getTradingDataSchema } = require("./tradingDataSchema");
const { PeriodResolver, resolvePeriodInput } = require("../Time/periodContract");
const { parseTradeId } = require("../Signals/tradeIdContract");

const TRADING_PERFORMANCE_SUMMARY = "trading.performance.summary";
const TRADING_RECORDS_QUERY = "trading.records.query";
const TRADING_SCHEMA_GET = "trading.schema.get";
const TRADING_TRADE_REFERENCE_RESOLVE = "trading.trade_reference.resolve";

class TradingDataCapability {
    constructor(options = {}) {
        this.name = "trading.data";
        this.supportedMetrics = Object.freeze([
            "general", "trade_count", "wins_losses", "net_rr", "win_rate"
        ]);
        this.metricOperations = Object.freeze(Object.fromEntries(
            this.supportedMetrics.map((metric) => [metric, TRADING_PERFORMANCE_SUMMARY])
        ));
        this.declaration = createCapabilityDeclaration({
            capabilityId: this.name,
            domain: "trading",
            version: "1.0.0",
            supportedOperations: [TRADING_PERFORMANCE_SUMMARY, TRADING_RECORDS_QUERY,
                TRADING_SCHEMA_GET, TRADING_TRADE_REFERENCE_RESOLVE],
            executionMode: EXECUTION_MODES.SYNCHRONOUS,
            behavior: CAPABILITY_BEHAVIORS.READ_ONLY,
            approvalRequirement: APPROVAL_REQUIREMENTS.NONE,
            lifecycleSupport: [LIFECYCLE_STAGES.COLLECT, LIFECYCLE_STAGES.ANALYZE],
            inputContractVersion: "1.0",
            outputContractVersion: "1.0"
        });
        this.tradingDataSource = options.tradingDataSource === undefined
            ? new NotionCapability()
            : options.tradingDataSource;
        this.periodResolver = options.periodResolver || new PeriodResolver({
            clock: options.clock
        });

        if (!this.tradingDataSource ||
            typeof this.tradingDataSource.execute !== "function") {
            const error = new Error("Trading Data Capability requires a trading data source");
            error.code = "TRADING_DATA_SOURCE_REQUIRED";
            throw error;
        }
    }

    async execute(request) {
        if (!request || ![TRADING_PERFORMANCE_SUMMARY, TRADING_RECORDS_QUERY,
            TRADING_SCHEMA_GET, TRADING_TRADE_REFERENCE_RESOLVE]
            .includes(request.operation)) {
            const error = new Error("Unsupported Trading Data Capability operation");
            error.code = "TRADING_DATA_OPERATION_UNSUPPORTED";
            throw error;
        }

        if (request.operation === TRADING_SCHEMA_GET) {
            return {
                data: getTradingDataSchema(),
                summary: "Normalized trading data schema retrieved",
                evidence: [],
                sourceReferences: ["trading_data_schema"],
                recordCount: 0,
                executionMetadata: { facade: this.name, providerIndependent: true }
            };
        }

        if (request.operation === TRADING_TRADE_REFERENCE_RESOLVE) {
            const tradeId = request.input && request.input.tradeId;
            if (!parseTradeId(tradeId)) {
                const error = new Error("Canonical Trade ID is invalid");
                error.code = "TRADING_TRADE_REFERENCE_INVALID";
                throw error;
            }
            const resolved = await this.tradingDataSource.execute({
                intent: "resolve_trade_reference",
                source: "trading_journal",
                tradeId
            });
            return {
                data: {
                    exists: resolved.matchCount === 1,
                    matchCount: resolved.matchCount,
                    reference: resolved.reference
                },
                summary: "Canonical trading reference resolved",
                evidence: [],
                sourceReferences: resolved.reference
                    ? [resolved.reference.entityId] : [],
                recordCount: resolved.matchCount,
                executionMetadata: {
                    facade: this.name,
                    providerIndependent: true
                }
            };
        }

        const suppliedPeriod = request.input && request.input.period;
        let period;
        if (suppliedPeriod !== undefined) {
            try { period = resolvePeriodInput(suppliedPeriod, this.periodResolver); }
            catch (cause) {
                const error = new Error(cause.message);
                error.code = "TRADING_DATA_PERIOD_UNSUPPORTED";
                error.periodErrorCode = cause.code || null;
                throw error;
            }
        }

        if (request.operation === TRADING_RECORDS_QUERY) {
            validateRequiredFields(request.input && request.input.requiredFields);
            validateOrdering(request.input && request.input.ordering);
            const normalized = await this.tradingDataSource.execute({
                intent: "get_normalized_trades",
                source: "trading_journal",
                ...(period ? { period } : {}),
                ...(request.input.filters ? { filters: request.input.filters } : {})
            });
            const requiredFields = request.input.requiredFields;
            const records = normalized.records.map((record) =>
                Object.fromEntries(requiredFields.map((field) => [field, record[field]])));
            return {
                data: { records },
                summary: "Normalized trading records retrieved",
                evidence: [],
                sourceReferences: ["trading_journal"],
                recordCount: records.length,
                executionMetadata: {
                    facade: this.name,
                    facadeVersion: this.declaration.version,
                    period: period || "all_time",
                    fields: requiredFields,
                    ...(request.input.ordering ? { ordering: request.input.ordering } : {})
                }
            };
        }

        const performanceSummary = await this.tradingDataSource.execute({
            intent: "get_performance_summary",
            source: "trading_journal",
            ...(period ? { period } : {})
        });

        return {
            data: performanceSummary,
            summary: "Trading performance summary retrieved",
            evidence: [],
            sourceReferences: ["trading_journal"],
            recordCount: performanceSummary.totalTrades,
            executionMetadata: {
                facade: this.name,
                facadeVersion: this.declaration.version,
                period: period || "all_time"
            }
        };
    }
}

function validateRequiredFields(fields) {
    if (!Array.isArray(fields) || fields.length === 0 ||
        fields.some((field) => !["result", "realizedRR", "tradeDate"].includes(field))) {
        const error = new Error("Trading record fields are invalid or unsupported");
        error.code = "TRADING_DATA_FIELDS_UNSUPPORTED";
        throw error;
    }
}

function validateOrdering(ordering) {
    if (ordering === undefined) return;
    if (!ordering || ordering.field !== "tradeDate" ||
        !["ascending", "descending"].includes(ordering.direction)) {
        const error = new Error("Trading record ordering is invalid or unsupported");
        error.code = "TRADING_DATA_ORDERING_UNSUPPORTED";
        throw error;
    }
}

module.exports = TradingDataCapability;
module.exports.TRADING_PERFORMANCE_SUMMARY = TRADING_PERFORMANCE_SUMMARY;
module.exports.TRADING_RECORDS_QUERY = TRADING_RECORDS_QUERY;
module.exports.TRADING_SCHEMA_GET = TRADING_SCHEMA_GET;
module.exports.TRADING_TRADE_REFERENCE_RESOLVE = TRADING_TRADE_REFERENCE_RESOLVE;
