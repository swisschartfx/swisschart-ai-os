const assert = require("assert");

const AutomationExecutionRouter = require("./automationExecutionRouter");

async function run() {
    const notionCalls = [];
    const formatterCalls = [];
    const router = new AutomationExecutionRouter({
        notionCapability: {
            async execute(input) {
                notionCalls.push(input);
                return {
                    type: "notion_result",
                    data: { type: "trade_history", count: 0, trades: [] }
                };
            }
        },
        telegramFormatter: {
            format(input) {
                formatterCalls.push(input);
                return {
                    type: "telegram_message",
                    content: "Formatted result"
                };
            }
        }
    });

    const notionResult = await router.execute({
        action: {
            capabilityRequirement: "notion",
            intent: "get_trade_history",
            input: { filters: { pair: "EURUSD" } }
        }
    });
    assert.strictEqual(notionResult.type, "notion_result");
    assert.deepStrictEqual(notionCalls, [{
        intent: "get_trade_history",
        filters: { pair: "EURUSD" }
    }]);

    const formatterInput = {
        type: "notion_result",
        data: { type: "performance_summary", totalTrades: 2 }
    };
    const formatterResult = await router.execute({
        action: {
            capabilityRequirement: "telegram_formatter",
            intent: "format",
            input: formatterInput
        }
    });
    assert.deepStrictEqual(formatterResult, {
        type: "telegram_message",
        content: "Formatted result"
    });
    assert.deepStrictEqual(formatterCalls, [formatterInput]);

    await assert.rejects(
        () => router.execute({
            action: {
                capabilityRequirement: "unknown",
                intent: "execute",
                input: {}
            }
        }),
        error => error.code === "AUTOMATION_CAPABILITY_UNSUPPORTED"
    );

    assert.strictEqual(router.scheduler, undefined);
    assert.strictEqual(router.telegramService, undefined);
    console.log("Automation Execution Router test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
