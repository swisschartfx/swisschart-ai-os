const crypto = require("crypto");
const { PeriodResolver, BUSINESS_TIMEZONE, PRESETS } = require(
    "../../02_Core/Time/periodContract"
);

const TOOL_NAME = "swisschart.query";
const TOOL_SCHEMA_VERSION = "4.6";
const FOUNDER_SIGNAL_ROUTING_INSTRUCTIONS =
    "In the Swisschart Founder interface, an exact user message of \"Signal\" " +
    "or \"سیگنال\" means start a new Swisschart trading signal intake. " +
    "Invoke swisschart.query with requestType=signal_intake_start immediately. " +
    "Do not ask what kind of signal the Founder means. Apply this exact-command " +
    "rule only to those standalone messages; do not generalize it to unrelated " +
    "phrases containing signal.";
const BUSINESS_QUERIES = Object.freeze([
    "trade_count", "win_rate", "performance_summary", "profit_factor",
    "max_consecutive_losses"
]);
const LEGACY_QUERIES = Object.freeze(new Map([
    ["current_month_trade_count", "trade_count"],
    ["current_month_win_rate", "win_rate"],
    ["current_month_performance_summary", "performance_summary"],
    ["current_month_profit_factor", "profit_factor"],
    ["current_month_max_consecutive_losses", "max_consecutive_losses"]
]));
const ALLOWED_OPERATIONS = Object.freeze(new Map([
    ["trading.data", new Set([
        "trading.performance.summary",
        "trading.records.query",
        "trading.schema.get"
    ])],
    ["trading.analytics", new Set(["trading.analytics.calculate"])],
    ["trading.general_analysis", new Set([
        "trading.general_analysis.execute"
    ])]
]));

class McpEdge {
    constructor(options = {}) {
        if (!options.assistant || typeof options.assistant.handle !== "function") {
            throw new Error("MCP Edge requires SwisschartAssistant");
        }
        if (typeof options.bearerToken !== "string" || !options.bearerToken) {
            throw new Error("MCP Edge requires a bearer token");
        }
        this.assistant = options.assistant;
        this.bearerToken = options.bearerToken;
        this.oauthTokenValidator = options.oauthTokenValidator || (() => false);
        this.periodResolver = options.periodResolver || new PeriodResolver({
            clock: options.clock
        });
        this.logger = options.logger;
        this.signalCoordinator = options.signalCoordinator || null;
        this.telegramCoordinator = options.telegramCoordinator || null;
        this.genericTelegramCoordinator = options.genericTelegramCoordinator || null;
    }

    authenticate(header) {
        if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
        const token = header.slice(7);
        if (this.oauthTokenValidator(token)) return true;
        const supplied = crypto.createHash("sha256").update(token).digest();
        const expected = crypto.createHash("sha256").update(this.bearerToken).digest();
        return crypto.timingSafeEqual(supplied, expected);
    }

    async handleRpc(message, requestId) {
        if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
            return rpcError(message && message.id, -32600, "Invalid Request");
        }
        if (message.method === "notifications/initialized") return null;
        if (message.method === "initialize") {
            this.log("mcp_initialize", { requestId, outcome: "completed",
                protocolVersion: "2025-03-26",
                toolSchemaVersion: TOOL_SCHEMA_VERSION });
            return rpcResult(message.id, {
                protocolVersion: "2025-03-26",
                capabilities: { tools: { listChanged: false } },
                serverInfo: { name: "swisschart-read-only", version: "1.1.0" },
                instructions: FOUNDER_SIGNAL_ROUTING_INSTRUCTIONS
            });
        }
        if (message.method === "tools/list") {
            this.log("mcp_tools_list", { requestId, outcome: "completed",
                toolCount: 1, toolName: TOOL_NAME,
                toolSchemaVersion: TOOL_SCHEMA_VERSION });
            return rpcResult(message.id, { tools: [toolDefinition()] });
        }
        if (message.method !== "tools/call") {
            return rpcError(message.id, -32601, "Method not found");
        }
        const params = message.params;
        if (!params || params.name !== TOOL_NAME || !isObject(params.arguments)) {
            return rpcError(message.id, -32602, "Invalid tool arguments");
        }
        if (["signal_intake_start", "signal_validate", "signal_prepare", "signal_approve"].includes(params.arguments.requestType)) {
            if (!this.signalCoordinator) return rpcResult(message.id, toolError("Signal creation is unavailable"));
            try {
                const result = params.arguments.requestType === "signal_intake_start"
                    ? this.signalCoordinator.start()
                    : params.arguments.requestType === "signal_validate"
                        ? this.signalCoordinator.validate(params.arguments)
                    : params.arguments.requestType === "signal_prepare"
                        ? this.signalCoordinator.prepare(params.arguments)
                        : await this.signalCoordinator.approve(params.arguments, requestId);
                this.log("mcp_signal_action", { requestId, outcome: result.status, requestType: params.arguments.requestType });
                return rpcResult(message.id, { content: [{ type: "text", text: JSON.stringify(result) }], isError: false });
            } catch (error) {
                this.log("mcp_signal_action", { requestId, outcome: "rejected", requestType: params.arguments.requestType, code: error.code || "SIGNAL_ACTION_REJECTED" });
                return rpcResult(message.id, toolError(error.code || "Signal action rejected"));
            }
        }
        if (["signal_publish_prepare", "signal_publish_approve"].includes(params.arguments.requestType)) {
            if (!this.telegramCoordinator) return rpcResult(message.id, toolError("Signal publishing is unavailable"));
            try {
                const result = params.arguments.requestType === "signal_publish_prepare" ? this.telegramCoordinator.prepare(params.arguments) : await this.telegramCoordinator.approve(params.arguments, requestId);
                this.log("mcp_telegram_signal_action", { requestId, outcome: result.status, requestType: params.arguments.requestType });
                return rpcResult(message.id, { content: [{ type: "text", text: JSON.stringify(result) }], isError: false });
            } catch (error) {
                this.log("mcp_telegram_signal_action", { requestId, outcome: "rejected", requestType: params.arguments.requestType, code: error.code || "TELEGRAM_ACTION_REJECTED" });
                return rpcResult(message.id, toolError(error.code || "Telegram signal action rejected"));
            }
        }
        if (["telegram_publish_prepare", "telegram_publish_approve"].includes(params.arguments.requestType)) {
            if (!this.genericTelegramCoordinator) {
                return rpcResult(message.id, toolError("Generic Telegram publishing is unavailable"));
            }
            try {
                const result =
                    params.arguments.requestType === "telegram_publish_prepare"
                        ? await this.genericTelegramCoordinator.prepare(params.arguments, requestId)
                        : await this.genericTelegramCoordinator.approve(params.arguments);

                return rpcResult(message.id, {
                    content: [{ type: "text", text: JSON.stringify(result) }],
                    isError: false
                });
            } catch (error) {
                return rpcResult(message.id,
                    toolError(error.code || "Generic Telegram action rejected"));
            }
        }

        if (SCHEDULE_REQUESTS.has(params.arguments.requestType)) {
            const scheduleRequest = normalizeScheduleRequest(params.arguments);
            try {
                const result = await this.assistant.handle({
                    type: "capability", requestId,
                    capability: "schedule.management",
                    operation: scheduleRequest.operation,
                    input: scheduleRequest.input,
                    context: scheduleAuthorityContext(scheduleRequest),
                    constraints: { schedulerActivationAllowed: false,
                        approvedMutation: scheduleRequest.operation.endsWith(".approve") &&
                            scheduleRequest.input.confirm === true },
                    metadata: { transport: "remote_mcp" },
                    requestedBy: "founder", source: "claude-remote-mcp",
                    inputContractVersion: "1.0"
                });
                const success = result && result.status !== "failed";
                this.log("mcp_schedule_action", { requestId,
                    outcome: success ? result.status : "failed",
                    requestType: params.arguments.requestType });
                return rpcResult(message.id, { content: [{ type: "text",
                    text: JSON.stringify(result) }], isError: !success });
            } catch (error) {
                this.log("mcp_schedule_action", { requestId, outcome: "failed",
                    requestType: params.arguments.requestType });
                return rpcResult(message.id, toolError("Schedule action failed safely"));
            }
        }
        let normalizedInput;
        try {
            normalizedInput = normalizeBusinessQuery(params.arguments,
                this.periodResolver);
        } catch (error) {
            this.log("mcp_execution", { requestId, outcome: "rejected",
                query: params.arguments.query || null });
            return rpcResult(message.id, toolError("Business period is invalid"));
        }
        const authorization = authorizeReadOnly(normalizedInput);
        if (!authorization.allowed) {
            this.log("mcp_execution", {
                requestId,
                outcome: "rejected",
                query: params.arguments.query || null,
                capability: params.arguments.capability || null,
                operation: params.arguments.operation || null
            });
            return rpcResult(message.id, toolError(authorization.message));
        }

        const input = normalizedInput;
        try {
            const result = await this.assistant.handle({
                type: "capability",
                requestId,
                capability: input.capability,
                operation: input.operation,
                input: input.input || {},
                context: input.context || {},
                constraints: { ...(input.constraints || {}), readOnly: true },
                metadata: { transport: "remote_mcp" },
                requestedBy: "founder",
                source: "claude-remote-mcp",
                inputContractVersion: "1.0"
            });
            const success = result && result.status !== "failed";
            this.log("mcp_execution", {
                requestId,
                outcome: success ? result.status : "failed",
                capability: input.capability,
                operation: input.operation
            });
            return rpcResult(message.id, {
                content: [{ type: "text", text: JSON.stringify(result) }],
                isError: !success
            });
        } catch (error) {
            this.log("mcp_execution", { requestId, outcome: "failed" });
            return rpcResult(message.id, toolError("Swisschart query failed safely"));
        }
    }

    log(event, fields) {
        if (this.logger && typeof this.logger.info === "function") {
            this.logger.info(event, fields);
        }
    }
}

function authorizeReadOnly(input) {
    if (input.intent && !["read", "analyze"].includes(input.intent)) {
        return { allowed: false, message: "Only read and analyze intents are allowed" };
    }
    const operations = ALLOWED_OPERATIONS.get(input.capability);
    if (!operations || !operations.has(input.operation)) {
        return { allowed: false, message: "Capability operation is not allowed" };
    }
    return { allowed: true };
}

function toolDefinition() {
    return {
        name: TOOL_NAME,
        description: "Swisschart business interface schema v4.5. Use for authoritative Trading Journal analytics, the Founder's trading-signal workflow, generic Telegram publishing, and configurable schedule management. For ordinary text publishing to the primary Telegram channel, use requestType=telegram_publish_prepare and require a separate explicit approval with telegram_publish_approve. Do not use the signal workflow unless the content is a trading signal. In this Founder interface, the exact standalone user message \"Signal\" or \"سیگنال\" unambiguously means start a new Swisschart trading signal intake: invoke swisschart.query with requestType=signal_intake_start immediately and do not ask what kind of signal is meant. This exact-command rule does not apply to unrelated phrases containing signal. Schedule list/inspect are read-only. Every schedule create, update, enable, disable, or delete uses separate prepare and explicit approve calls. Swisschart remains authoritative for validation, calculations, approvals, Notion creation, Telegram publication, and deterministic scheduling. Notion creation, Telegram publication, and schedule mutations require separate explicit Founder approvals.",
        inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
                requestType: {
                    type: "string",
                    enum: ["query", "signal_intake_start", "signal_validate",
                        "signal_prepare", "signal_approve",
                        "signal_publish_prepare", "signal_publish_approve",
                        "telegram_publish_prepare", "telegram_publish_approve",
                        "schedule_list", "schedule_inspect",
                        "schedule_create_prepare", "schedule_create_approve",
                        "schedule_update_prepare", "schedule_update_approve",
                        "schedule_delete_prepare", "schedule_delete_approve"],
                    description: "For the exact standalone Founder message Signal or سیگنال, select signal_intake_start immediately without clarification. Use signal_validate for Founder-supplied snapshots. For ordinary Telegram text publishing, select telegram_publish_prepare; after explicit Founder approval use telegram_publish_approve. Never use the signal publishing flow unless the content is a trading signal. Preparation and approval requestTypes remain separate backend-controlled actions."
                },
                query: {
                    type: "string", enum: BUSINESS_QUERIES,
                    description: "trade_count, win_rate, performance_summary, profit_factor, or max_consecutive_losses. Select by meaning in any language."
                },
                period: periodSchema(),
                signal: signalSchema(),
                signalReference: { type: "string",
                    pattern: "^SCT-\\d{2}(0[1-9]|[1-9]\\d)$" },
                content: { type: "string", minLength: 1 },
                content_type: { type: "string", enum: ["text"] },
                destination: { type: "string", enum: ["telegram.primary"] },
                format: { type: "string", enum: ["HTML"] },
                metadata: { type: "object", additionalProperties: true },
                approvalId: { type: "string" },
                payloadHash: { type: "string", pattern: "^[a-f0-9]{64}$" },
                confirm: { type: "boolean" },
                scheduleId: { type: "string" },
                expectedRevision: { type: "integer", minimum: 1 },
                schedule: { type: "object", additionalProperties: true },
                updates: { type: "object", additionalProperties: true },
                filters: { type: "object", additionalProperties: true }
            },
            anyOf: [
                { required: ["query", "period"] },
                { properties: { requestType: { const: "signal_intake_start" } },
                    required: ["requestType"] },
                { properties: { requestType: { const: "signal_validate" } },
                    required: ["requestType", "signal"] },
                { properties: { requestType: { const: "signal_prepare" } },
                    required: ["requestType", "signal"] },
                { properties: { requestType: { enum: ["signal_approve",
                    "signal_publish_approve"] } }, required: ["requestType",
                    "approvalId", "payloadHash", "confirm"] },
                { properties: { requestType: { const: "signal_publish_prepare" } },
                    required: ["requestType", "signalReference", "signal"] },
                { properties: { requestType: { const: "telegram_publish_prepare" } },
                    required: ["requestType", "content"] },
                { properties: { requestType: { const: "telegram_publish_approve" } },
                    required: ["requestType", "approvalId", "payloadHash", "confirm"] },
                { properties: { requestType: { const: "schedule_list" } },
                    required: ["requestType"] },
                { properties: { requestType: { const: "schedule_inspect" } },
                    required: ["requestType", "scheduleId"] },
                { properties: { requestType: { const: "schedule_create_prepare" } },
                    required: ["requestType", "schedule"] },
                { properties: { requestType: { const: "schedule_update_prepare" } },
                    required: ["requestType", "scheduleId", "expectedRevision", "updates"] },
                { properties: { requestType: { const: "schedule_delete_prepare" } },
                    required: ["requestType", "scheduleId", "expectedRevision"] },
                { properties: { requestType: { enum: ["schedule_create_approve",
                    "schedule_update_approve", "schedule_delete_approve"] } },
                    required: ["requestType", "approvalId", "payloadHash", "confirm"] }
            ]
        }
    };
}

const SCHEDULE_REQUESTS = new Set([
    "schedule_list", "schedule_inspect", "schedule_create_prepare",
    "schedule_create_approve", "schedule_update_prepare",
    "schedule_update_approve", "schedule_delete_prepare",
    "schedule_delete_approve"
]);

function normalizeScheduleRequest(input) {
    const operations = {
        schedule_list: "schedule.list", schedule_inspect: "schedule.inspect",
        schedule_create_prepare: "schedule.create.prepare",
        schedule_create_approve: "schedule.create.approve",
        schedule_update_prepare: "schedule.update.prepare",
        schedule_update_approve: "schedule.update.approve",
        schedule_delete_prepare: "schedule.delete.prepare",
        schedule_delete_approve: "schedule.delete.approve"
    };
    return { operation: operations[input.requestType], input: {
        ...(input.filters ? { filters: input.filters } : {}),
        ...(input.scheduleId ? { scheduleId: input.scheduleId } : {}),
        ...(input.expectedRevision ? { expectedRevision: input.expectedRevision } : {}),
        ...(input.schedule ? { schedule: input.schedule } : {}),
        ...(input.updates ? { updates: input.updates } : {}),
        ...(input.approvalId ? { approvalId: input.approvalId } : {}),
        ...(input.payloadHash ? { payloadHash: input.payloadHash } : {}),
        ...(input.confirm !== undefined ? { confirm: input.confirm } : {})
    } };
}

function scheduleAuthorityContext(request) {
    const approved = request.operation.endsWith(".approve") &&
        request.input.confirm === true;
    return {
        authenticatedFounder: true,
        ...(approved ? {
            approvalVerified: true,
            payloadHash: request.input.payloadHash,
            idempotencyKey: request.input.approvalId
        } : {})
    };
}

function periodSchema() {
    return {
        type: "object",
        additionalProperties: false,
        required: ["contractVersion", "preset", "timezone"],
        properties: {
            contractVersion: { type: "string", const: "1.0" },
            preset: { type: "string", enum: PRESETS },
            timezone: { type: "string", const: BUSINESS_TIMEZONE },
            startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }
        },
        description: "Use a named New York business period. Preset all means the complete authoritative Trading Journal dataset with no date restriction. For explicit, include inclusive startDate and endDate. Swisschart resolves authoritative boundaries."
    };
}

function signalSchema() {
    return {
        type: "object", additionalProperties: false,
        properties: {
            pair: { type: "string",
                description: "Natural asset alias in Persian or English." },
            direction: { type: "string", enum: ["buy", "sell"] },
            entry: { type: "number" }, stopLoss: { type: "number" },
            tp1: { type: "number" }, tp2: { type: "number" },
            tp3: { type: "number" }, risk: { type: "number" },
            grade: { type: "integer", minimum: 1, maximum: 5 }
        },
        description: "Founder-supplied partial or complete signal snapshot. Swisschart performs all validation, normalization, and calculations."
    };
}

function normalizeBusinessQuery(input, periodResolver = new PeriodResolver()) {
    if (!isObject(input)) return input;
    const query = LEGACY_QUERIES.get(input.query) || input.query;
    if (!BUSINESS_QUERIES.includes(query)) return input;
    const semanticPeriod = input.period || (LEGACY_QUERIES.has(input.query) ? {
        contractVersion: "1.0", preset: "this_month",
        timezone: BUSINESS_TIMEZONE
    } : null);
    const period = periodResolver.resolve(semanticPeriod);
    if (["trade_count", "win_rate", "performance_summary"].includes(query)) {
        return {
            intent: "read",
            capability: "trading.data",
            operation: "trading.performance.summary",
            input: { period },
            context: { businessQuery: query },
            constraints: {}
        };
    }
    if (query === "profit_factor") {
        return {
            intent: "analyze",
            capability: "trading.analytics",
            operation: "trading.analytics.calculate",
            input: {
                requestedMetric: "profit_factor",
                analyticalGoal: "Profit Factor for the requested period",
                period,
                filters: { status: "closed" }
            },
            context: { businessQuery: query },
            constraints: {}
        };
    }
    return {
        intent: "analyze",
        capability: "trading.general_analysis",
        operation: "trading.general_analysis.execute",
        input: { plan: maxConsecutiveLossesPlan(period) },
        context: { businessQuery: query },
        constraints: {}
    };
}

function maxConsecutiveLossesPlan(period) {
    return {
        planVersion: "1.0",
        analysisGoal: "Maximum consecutive losses for the requested period",
        period,
        requiredFields: [{
            fieldId: "result",
            reason: "Identify losing trades",
            suggestedData: "Add normalized trade result"
        }],
        optionalFields: [],
        filters: { status: "closed" },
        ordering: { field: "tradeDate", direction: "ascending" },
        aggregationRequirements: [],
        calculationStrategy: {
            steps: [{
                id: "loss_streak",
                primitive: "ordered_streak",
                field: "result",
                equals: "loss"
            }],
            resultStep: "loss_streak"
        }
    };
}

function toolError(message) {
    return { content: [{ type: "text", text: message }], isError: true };
}

function rpcResult(id, result) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id, code, message) {
    return { jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } };
}
function isObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

module.exports = {
    McpEdge,
    TOOL_NAME,
    TOOL_SCHEMA_VERSION,
    BUSINESS_QUERIES,
    ALLOWED_OPERATIONS,
    authorizeReadOnly,
    normalizeBusinessQuery
};
