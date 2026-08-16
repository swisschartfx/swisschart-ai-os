const assert = require("assert");

const SwisschartAssistant = require("./01_assistant");
const CurrentMonthPerformanceRequestUnderstanding = require(
    "./currentMonthPerformanceRequestUnderstanding"
);
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const CapabilityGateway = require("../../02_Core/Capabilities/capabilityGateway");
const TradingDataCapability = require("../../02_Core/Capabilities/tradingDataCapability");

async function run() {
    const dataSourceCalls = [];
    const gatewayRequests = [];
    const registry = new CapabilityRegistry([
        new TradingDataCapability({
            tradingDataSource: {
                async execute(request) {
                    dataSourceCalls.push(request);
                    return {
                        totalTrades: 6,
                        closedTrades: 5,
                        wins: 3,
                        losses: 2,
                        breakEven: 0,
                        cancelled: 1,
                        pending: 0,
                        winRate: 0.6,
                        averageRR: 1.2,
                        netRR: 6
                    };
                }
            }
        })
    ]);
    const realGateway = new CapabilityGateway({ registry });
    const observedGateway = {
        async execute(request) {
            gatewayRequests.push(request);
            return realGateway.execute(request);
        }
    };
    const requestUnderstanding = new CurrentMonthPerformanceRequestUnderstanding({
        idGenerator: () => "assistant-conversation-request-1",
        clock: () => new Date("2026-08-13T17:00:00.000Z")
    });
    const assistant = new SwisschartAssistant({
        capabilityGateway: observedGateway,
        requestUnderstanding,
        taskEngine: {},
        ruleResolver: {},
        notionAgent: { handleRequest() {} },
        telegramPublishingWorkflow: { execute() {} },
        performanceSummaryTelegramWorkflow: { execute() {} }
    });

    const cases = [{
        question: "Performance this month چطوره؟",
        expected: "This month: 6 trades, win rate 60% (3 wins, 2 losses), net RR 6.",
        metric: "general"
    }, {
        question: "این ماه چند تا trade داشتیم؟",
        expected: "This month: 6 trades.",
        metric: "trade_count"
    }, {
        question: "این ماه چند برد و چند باخت داشتیم؟",
        expected: "This month: 3 wins and 2 losses.",
        metric: "wins_losses"
    }, {
        question: "Net RR این ماه چقدره؟",
        expected: "This month: net RR 6.",
        metric: "net_rr"
    }, {
        question: "Win rate this month چقدره؟",
        expected: "This month: win rate 60% (3 wins, 2 losses).",
        metric: "win_rate"
    }];

    for (const testCase of cases) {
        const response = await assistant.handle(testCase.question);
        assert.strictEqual(response.success, true);
        assert.strictEqual(response.intent, "current_month_trading_performance");
        assert.strictEqual(response.message, testCase.expected);
    }

    assert.strictEqual(gatewayRequests.length, cases.length);
    assert.deepStrictEqual(gatewayRequests[0], {
        contractVersion: "1.0",
        requestId: "assistant-conversation-request-1",
        capability: "trading.data",
        operation: "trading.performance.summary",
        input: { period: "current_month" },
        context: {},
        constraints: { readOnly: true },
        metadata: {
            understoodIntent: "current_month_trading_performance",
            requestedMetrics: "general"
        },
        requestedBy: "founder",
        source: "assistant-natural-language",
        timestamp: "2026-08-13T17:00:00.000Z",
        inputContractVersion: "1.0"
    });
    assert.deepStrictEqual(dataSourceCalls[0], {
        intent: "get_performance_summary",
        source: "trading_journal",
        period: "current_month"
    });
    assert.strictEqual(dataSourceCalls.length, cases.length);
    assert.deepStrictEqual(
        gatewayRequests.map((request) => request.metadata.requestedMetrics),
        cases.map((testCase) => testCase.metric)
    );
    assert.strictEqual(
        requestUnderstanding.understand("publish telegram: hello"),
        null
    );

    console.log("Current-month performance conversation test passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
