const assert = require("assert");
const http = require("http");

const { loadCloudConfig } = require("./cloudConfig");
const { McpEdge, normalizeBusinessQuery } = require("./mcpEdge");
const { createHttpServer } = require("./httpServer");
const ProductionRuntime = require("./productionRuntime");
const { createCloudComposition } = require("./cloudComposition");
const TradingDataCapability = require("../../02_Core/Capabilities/tradingDataCapability");
const { PeriodResolver, PRESETS } = require("../../02_Core/Time/periodContract");

const TOKEN = "founder-test-token-with-sufficient-length";

async function run() {
    testConfiguration();
    testBusinessQueryRouting();
    await testHttpAndMcpBoundary();
    await testExistingAssistantAndCapabilities();
    console.log("Cloud Runtime and secure read-only MCP tests passed");
}

function testBusinessQueryRouting() {
    const resolver = new PeriodResolver({
        clock: () => new Date("2026-08-14T02:30:00.000Z")
    });
    const period = { contractVersion: "1.0", preset: "last_week",
        timezone: "America/New_York" };
    const count = normalizeBusinessQuery({ query: "trade_count", period }, resolver);
    assert.strictEqual(count.capability, "trading.data");
    assert.strictEqual(count.operation, "trading.performance.summary");
    assert.strictEqual(count.input.period.timezone, "America/New_York");
    assert.strictEqual(count.input.period.startLocalDate <=
        count.input.period.endLocalDateExclusive, true);
    const winRate = normalizeBusinessQuery({ query: "win_rate", period }, resolver);
    assert.strictEqual(winRate.context.businessQuery, "win_rate");
    const summary = normalizeBusinessQuery({
        query: "performance_summary", period
    }, resolver);
    assert.strictEqual(summary.capability, "trading.data");
    const profitFactor = normalizeBusinessQuery({
        query: "profit_factor", period
    }, resolver);
    assert.strictEqual(profitFactor.capability, "trading.analytics");
    assert.strictEqual(profitFactor.input.requestedMetric, "profit_factor");
    const streak = normalizeBusinessQuery({
        query: "max_consecutive_losses", period
    }, resolver);
    assert.strictEqual(streak.capability, "trading.general_analysis");
    assert.strictEqual(streak.input.plan.ordering.field, "tradeDate");
    for (const query of ["trade_count", "win_rate", "performance_summary",
        "profit_factor", "max_consecutive_losses"]) {
        const routed = normalizeBusinessQuery({ query, period: {
            contractVersion: "1.0", preset: "all",
            timezone: "America/New_York"
        } }, resolver);
        const normalized = query === "max_consecutive_losses"
            ? routed.input.plan.period
            : routed.input.period;
        assert.strictEqual(normalized.preset, "all");
        assert.strictEqual(normalized.unbounded, true);
        assert.strictEqual(Object.hasOwn(normalized, "startLocalDate"), false);
        assert.strictEqual(Object.hasOwn(normalized, "endLocalDateExclusive"), false);
    }
    for (const preset of PRESETS) {
        const semantic = { contractVersion: "1.0", preset,
            timezone: "America/New_York",
            ...(preset === "explicit" ? {
                startDate: "2026-08-01", endDate: "2026-08-14"
            } : {}) };
        const routed = normalizeBusinessQuery({ query: "trade_count",
            period: semantic }, resolver);
        assert.strictEqual(routed.input.period.timezone, "America/New_York");
    }
    const cachedMission4 = normalizeBusinessQuery({
        query: "current_month_trade_count"
    }, resolver);
    assert.strictEqual(cachedMission4.context.businessQuery, "trade_count");
    assert.strictEqual(cachedMission4.input.period.startLocalDate, "2026-08-01");
    assert.throws(() => normalizeBusinessQuery({ query: "trade_count" }, resolver),
        (error) => error.code === "PERIOD_REQUIRED");
}

function testConfiguration() {
    const config = loadCloudConfig({
        PORT: "0",
        SWISSCHART_MCP_BEARER_TOKEN: TOKEN,
        SWISSCHART_PUBLIC_BASE_URL: "https://swisschart.example",
        SWISSCHART_OAUTH_FOUNDER_PASSWORD: "founder-oauth-test-password",
        SWISSCHART_OAUTH_STATE_FILE: "test-oauth-state.json",
        NOTION_API_TOKEN: "mock-notion-token",
        NOTION_DATABASE_ID: "mock-database",
        TELEGRAM_BOT_TOKEN: "mock-telegram-token",
        TELEGRAM_CHAT_ID: "mock-chat"
    });
    assert.strictEqual(config.port, 0);
    assert.strictEqual(config.telegramPollingEnabled, false);
    assert.throws(() => loadCloudConfig({}), (error) =>
        error.code === "CLOUD_ENVIRONMENT_MISSING" &&
        error.missingVariables.includes("SWISSCHART_MCP_BEARER_TOKEN") &&
        error.missingVariables.includes("SWISSCHART_OAUTH_STATE_FILE") &&
        error.missingVariables.includes("TELEGRAM_BOT_TOKEN"));
}

async function testHttpAndMcpBoundary() {
    const calls = [];
    const assistant = {
        async handle(request) {
            calls.push(request);
            return { status: "completed", summary: "mock read", data: { count: 2 } };
        }
    };
    const logger = { info() {}, error() {} };
    const signalCalls = [];
    const signalCoordinator = {
        start() {
            signalCalls.push("signal_intake_start");
            return { status: "collecting", nextField: "pair",
                nextPrompt: "Asset چیه؟" };
        }
    };
    const edge = new McpEdge({ assistant, bearerToken: TOKEN, logger,
        signalCoordinator });
    const server = createHttpServer({ edge, logger });
    const runtime = new ProductionRuntime({
        server, port: 0, host: "127.0.0.1", logger
    });
    const address = await runtime.start();
    const base = `http://127.0.0.1:${address.port}`;

    const health = await request(base, "/health", "GET");
    assert.strictEqual(health.status, 200);
    assert.deepStrictEqual(health.body, { status: "ok" });

    const initialized = await request(base, "/mcp", "POST", {
        jsonrpc: "2.0", id: 1, method: "initialize", params: {}
    }, `Bearer ${TOKEN}`);
    assert.strictEqual(initialized.body.result.serverInfo.name,
        "swisschart-read-only");
    assert.strictEqual(initialized.body.result.serverInfo.version, "1.1.0");
    const instructions = initialized.body.result.instructions;
    for (const contractPart of ["exact user message", "\"Signal\"", "\"سیگنال\"",
        "swisschart.query", "requestType=signal_intake_start", "immediately",
        "Do not ask what kind of signal", "standalone messages",
        "unrelated phrases containing signal"]) {
        assert(instructions.includes(contractPart));
    }
    const tools = await request(base, "/mcp", "POST", {
        jsonrpc: "2.0", id: 2, method: "tools/list", params: {}
    }, `Bearer ${TOKEN}`);
    assert.deepStrictEqual(tools.body.result.tools.map((tool) => tool.name),
        ["swisschart.query"]);
    const tool = tools.body.result.tools[0];
    assert(tool.description.includes("schema v4.5"));
    assert.strictEqual(tool.annotations, undefined);
    assert.deepStrictEqual(tool.inputSchema.properties.query.enum,
        ["trade_count", "win_rate", "performance_summary", "profit_factor",
            "max_consecutive_losses"]);
    const periodSchema = tool.inputSchema.properties.period;
    assert(periodSchema.properties.preset.enum.includes("all"));
    assert(periodSchema.description.includes("complete authoritative Trading Journal dataset"));
    assert(periodSchema.description.includes("no date restriction"));
    const visibleSchema = JSON.stringify(tool.inputSchema);
    assert.strictEqual(/capability|operation|provider/.test(visibleSchema), false);
    assert.deepStrictEqual(tool.inputSchema.properties.requestType.enum,
        ["query", "signal_intake_start", "signal_validate", "signal_prepare",
            "signal_approve", "signal_publish_prepare",
            "signal_publish_approve", "telegram_publish_prepare",
            "telegram_publish_approve", "schedule_list", "schedule_inspect",
            "schedule_create_prepare", "schedule_create_approve",
            "schedule_update_prepare", "schedule_update_approve",
            "schedule_delete_prepare", "schedule_delete_approve"]);
    const toolDescription = tool.description;
    for (const expression of ["exact standalone user message", "\"Signal\"",
        "\"سیگنال\"", "invoke swisschart.query",
        "requestType=signal_intake_start", "immediately",
        "do not ask what kind of signal", "unrelated phrases containing signal"]) {
        assert(toolDescription.includes(expression));
    }
    assert(toolDescription.includes("separate explicit Founder approvals"));
    assert(toolDescription.includes("Schedule list/inspect are read-only"));
    assert(toolDescription.includes("schedule mutations require separate explicit Founder approvals"));
    const requestTypeDescription =
        tool.inputSchema.properties.requestType.description;
    assert(requestTypeDescription.includes("exact standalone Founder message"));
    assert(requestTypeDescription.includes("Signal or سیگنال"));
    assert(requestTypeDescription.includes("signal_intake_start immediately"));
    assert(requestTypeDescription.includes("without clarification"));
    const startBranch = tool.inputSchema.anyOf[1];
    assert.strictEqual(startBranch.properties.requestType.const, "signal_intake_start");
    assert.deepStrictEqual(startBranch.required, ["requestType"]);

    const start = await request(base, "/mcp", "POST",
        semanticToolCall("swisschart.query", {
            requestType: "signal_intake_start"
        }), `Bearer ${TOKEN}`);
    const startResult = JSON.parse(start.body.result.content[0].text);
    assert.strictEqual(startResult.nextField, "pair");
    assert.strictEqual(startResult.nextPrompt, "Asset چیه؟");
    assert.deepStrictEqual(signalCalls, ["signal_intake_start"]);

    const rpc = semanticToolCall("swisschart.query", {
        query: "trade_count", period: testPeriod()
    });
    assert.strictEqual((await request(base, "/mcp", "POST", rpc)).status, 401);
    assert.strictEqual((await request(base, "/mcp", "POST", rpc,
        "Bearer wrong-token")).status, 401);
    const accepted = await request(base, "/mcp", "POST", rpc, `Bearer ${TOKEN}`);
    assert.strictEqual(accepted.status, 200);
    assert.strictEqual(accepted.body.result.isError, false);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].type, "capability");
    assert.strictEqual(calls[0].source, "claude-remote-mcp");
    assert.strictEqual(calls[0].constraints.readOnly, true);

    const rejected = await request(base, "/mcp", "POST",
        toolCall("publishing.telegram", "publishing.telegram.publish",
            { message: "must not publish" }, "write"), `Bearer ${TOKEN}`);
    assert.strictEqual(rejected.body.result.isError, true);
    assert.strictEqual(calls.length, 1);
    await runtime.shutdown();
}

async function testExistingAssistantAndCapabilities() {
    let understandingCalls = 0;
    const records = [
        { result: "Win", realizedRR: 2, tradeDate: "2026-08-01" },
        { result: "Loss", realizedRR: -1, tradeDate: "2026-08-02" }
    ];
    const tradingDataCapability = new TradingDataCapability({
        tradingDataSource: {
            async execute(request) {
                if (request.intent === "get_normalized_trades") return { records };
                return {
                    totalTrades: 2, wins: 1, losses: 1, winRate: 0.5, netRR: 1
                };
            }
        }
    });
    const composition = createCloudComposition({ tradingDataCapability });
    composition.assistant.requestUnderstanding = {
        async understand() { understandingCalls += 1; throw new Error("must bypass"); }
    };

    const read = await composition.assistant.handle(capabilityRequest(
        "trading.data", "trading.performance.summary", {}));
    assert.strictEqual(read.status, "completed");
    const analytics = await composition.assistant.handle(capabilityRequest(
        "trading.analytics", "trading.analytics.calculate", {
            requestedMetric: "profit_factor",
            analyticalGoal: "Calculate profit factor",
            period: "current_month"
        }));
    assert.strictEqual(analytics.status, "completed");
    assert.strictEqual(analytics.data.result.value, 2);
    const general = await composition.assistant.handle(capabilityRequest(
        "trading.general_analysis", "trading.general_analysis.execute", {
            plan: {
                planVersion: "1.0",
                analysisGoal: "Maximum consecutive losses",
                period: "current_month",
                requiredFields: [{
                    fieldId: "result", reason: "Identify losses",
                    suggestedData: "Add normalized result"
                }],
                optionalFields: [], filters: { status: "closed" },
                ordering: null, aggregationRequirements: [],
                calculationStrategy: {
                    steps: [{ id: "loss_streak", primitive: "ordered_streak",
                        field: "result", equals: "Loss" }],
                    resultStep: "loss_streak"
                }
            }
        }));
    assert.strictEqual(general.status, "completed");
    assert.strictEqual(general.data.result, 1);
    assert.strictEqual(understandingCalls, 0);
}

function capabilityRequest(capability, operation, input) {
    return { type: "capability", capability, operation, input,
        requestedBy: "founder", source: "test", inputContractVersion: "1.0" };
}
function toolCall(capability, operation, input, intent) {
    return { jsonrpc: "2.0", id: 1, method: "tools/call", params: {
        name: "swisschart.query", arguments: { capability, operation, input, intent }
    } };
}
function semanticToolCall(name, args) {
    return { jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name, arguments: args } };
}
function testPeriod() {
    return { contractVersion: "1.0", preset: "this_month",
        timezone: "America/New_York" };
}
function request(base, path, method, body, authorization) {
    const url = new URL(path, base);
    const payload = body === undefined ? null : JSON.stringify(body);
    return new Promise((resolve, reject) => {
        const req = http.request(url, {
            method,
            headers: {
                ...(payload ? { "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(payload) } : {}),
                ...(authorization ? { Authorization: authorization } : {})
            }
        }, (res) => {
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                const text = Buffer.concat(chunks).toString("utf8");
                resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null });
            });
        });
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
