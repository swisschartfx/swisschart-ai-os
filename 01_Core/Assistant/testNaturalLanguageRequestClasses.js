const assert = require("assert");
const SwisschartAssistant = require("./01_assistant");
const LLMRequestUnderstanding = require("./llmRequestUnderstanding");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const TradingDataCapability = require("../../02_Core/Capabilities/tradingDataCapability");
const TradingAnalyticsCapability = require(
    "../../02_Core/Capabilities/tradingAnalyticsCapability");
const TelegramPublishingCapability = require(
    "../../02_Core/Capabilities/telegramPublishingCapability");

async function run() {
    const tradingData = new TradingDataCapability({
        tradingDataSource: { async execute() { return summary(); } }
    });
    const publishing = new TelegramPublishingCapability({
        ruleResolver: { resolve() { return { mode: "approval_required", source: "test",
            rule: null }; } },
        taskEngine: { async execute() { return { task: { taskId: "task-1",
            status: "awaiting_approval", approval: { required: true, status: "pending" } },
        result: { status: "blocked", summary: "Awaiting founder approval" } }; } }
    });
    const registry = new CapabilityRegistry([tradingData,
        new TradingAnalyticsCapability({ tradingDataCapability: tradingData }), publishing]);

    const conversationalCases = [
        ["سلام، حالت چطوره؟", "سلام! من دستیار Swisschart هستم."],
        ["Who are you?", "I’m the Swisschart Assistant."],
        ["چه کمکی ازت برمیاد؟", "می‌توانم گفتگو کنم و درخواست‌های کاری را به قابلیت‌های مجاز هدایت کنم."],
        ["The market felt unusual today.", "It certainly can feel that way; I won’t infer Swisschart results without data."]
    ];
    for (const [message, responseCandidate] of conversationalCases) {
        const gatewayCalls = [];
        const assistant = createAssistant(registry, conversation(message,
            responseCandidate), gatewayCalls);
        const response = await assistant.handle(message);
        assert.strictEqual(response.intent, "conversation");
        assert.strictEqual(response.message, responseCandidate);
        assert.strictEqual(gatewayCalls.length, 0);
    }

    for (const spec of [
        request("read", "trade_count", "trading.data", "trading.performance.summary"),
        request("read", "win_rate", "trading.data", "trading.performance.summary"),
        request("analyze", "profit_factor", "trading.analytics",
            "trading.analytics.calculate", true),
        request("read", "wins_losses", "trading.data", "trading.performance.summary"),
        request("read", "net_rr", "trading.data", "trading.performance.summary")
    ]) {
        const gatewayCalls = [];
        const understood = new LLMRequestUnderstanding({ capabilityRegistry: registry,
            provider: provider(spec) });
        const result = await understood.understand(spec.originalRequest);
        assert.strictEqual(result.executable, true);
        assert.ok(result.capabilityRequest);
        assert.strictEqual(result.capabilityRequest.capability,
            spec.requestedMetric === "profit_factor" ? "trading.analytics" : "trading.data");
    }

    for (const spec of [
        nonExecutable("prepare", "یک متن صبح بخیر برای کانال آماده کن"),
        nonExecutable("prepare", "Draft a morning Telegram post"),
        nonExecutable("schedule", "هر روز ساعت هشت این متن را منتشر کن"),
        nonExecutable("schedule", "Publish this every day at 8 AM")
    ]) {
        const result = await new LLMRequestUnderstanding({ capabilityRegistry: registry,
            provider: provider(spec) }).understand(spec.originalRequest);
        assert.strictEqual(result.executable, false);
        assert.strictEqual(result.requestClass, spec.requestClass);
        assert.ok(result.unsupportedReason.endsWith("_capability_not_available"));
        assert.strictEqual(result.capabilityRequest, null);
    }

    const actionSpec = { ...base("action", "این متن را منتشر کن: صبح بخیر"),
        requiresCapability: true, domain: "publishing",
        capabilityCandidate: "publishing.telegram",
        operationCandidate: "publishing.telegram.publish", content: "صبح بخیر" };
    const actionCalls = [];
    const actionResponse = await createAssistant(registry, actionSpec, actionCalls)
        .handle(actionSpec.originalRequest);
    assert.strictEqual(actionCalls.length, 1);
    assert.strictEqual(actionCalls[0].capability, "publishing.telegram");
    assert.strictEqual(actionCalls[0].input.message, "صبح بخیر");
    assert.strictEqual(actionResponse.success, false);
    assert.strictEqual(actionResponse.capabilityResult.status, "blocked");
    assert.strictEqual(actionResponse.capabilityResult.data.approvalStatus, "pending");

    console.log("Natural-language request class tests passed");
}

function createAssistant(registry, output, calls) {
    const gateway = new (require("../../02_Core/Capabilities/capabilityGateway"))({ registry });
    return new SwisschartAssistant({
        capabilityGateway: { async execute(request) { calls.push(request);
            return gateway.execute(request); } },
        requestUnderstanding: new LLMRequestUnderstanding({ capabilityRegistry: registry,
            provider: provider(output) }), taskEngine: {}, ruleResolver: {},
        notionAgent: { handleRequest() {} }, telegramPublishingWorkflow: { execute() {} },
        performanceSummaryTelegramWorkflow: { execute() {} }
    });
}

function base(requestClass, originalRequest) {
    return { requestClass, requiresCapability: false, domain: null,
        requestedMetric: null, analyticalGoal: null, period: null,
        capabilityCandidate: null, operationCandidate: null,
        calculationRequired: null, responseCandidate: null, content: null,
        confidence: 0.96, originalRequest };
}
function conversation(text, response) { return { ...base("conversation", text),
    responseCandidate: response }; }
function nonExecutable(kind, text) { return base(kind, text); }
function request(kind, metric, capability, operation, calculationRequired = false) {
    return { ...base(kind, `${metric} paraphrase`), requiresCapability: true,
        domain: "trading", requestedMetric: metric, analyticalGoal: `Get ${metric}`,
        period: "current_month", capabilityCandidate: capability,
        operationCandidate: operation, calculationRequired };
}
function provider(data) { return { async generateStructured() { return { ok: true,
    provider: "mock", model: "mock", data, usage: {}, metadata: {} }; } }; }
function summary() { return { totalTrades: 4, wins: 2, losses: 2, winRate: 0.5,
    netRR: 1, records: [{ result: "win", realizedRR: 2 },
        { result: "loss", realizedRR: -1 }] }; }

run().catch((error) => { console.error(error); process.exitCode = 1; });
