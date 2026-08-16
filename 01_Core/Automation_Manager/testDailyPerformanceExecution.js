const assert = require("assert");

const AutomationOrchestrator = require("./automationOrchestrator");
const AutomationExecutionRouter = require("../Task_Engine/automationExecutionRouter");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const NotionCapability = require("../../02_Core/Capabilities/notionCapability");
const TelegramFormatterCapability = require("../../02_Core/Capabilities/telegramFormatterCapability");

async function run() {
    const approvalRequests = [];
    const founderApproval = {
        name: "founder_approval",
        async execute(request) {
            approvalRequests.push(request);
            return {
                type: "approval_request",
                status: "pending",
                content: request.message
            };
        }
    };
    const registry = new CapabilityRegistry([
        new NotionCapability(),
        new TelegramFormatterCapability(),
        founderApproval
    ]);
    const router = new AutomationExecutionRouter({
        capabilityRegistry: registry
    });
    const orchestrator = new AutomationOrchestrator({
        executionRouter: router
    });
    const workflow = {
        automationId: "daily-performance-report-execution",
        steps: [
            {
                capabilityRequirement: "notion",
                intent: "get_performance_summary",
                input: { source: "trading_journal" }
            },
            {
                capabilityRequirement: "telegram_formatter",
                intent: "format_performance_report"
            },
            {
                capabilityRequirement: "founder_approval",
                intent: "request_approval"
            }
        ]
    };

    const result = await orchestrator.execute(workflow);

    assert.strictEqual(result.status, "completed");
    assert.strictEqual(result.steps.length, 3);
    assert.deepStrictEqual(result.steps[0].output, {
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        averageRR: 0
    });
    assert.strictEqual(result.steps[1].output.type, "telegram_message");
    assert.match(result.steps[1].output.message, /Swisschart Performance/);
    assert.strictEqual(approvalRequests.length, 1);
    assert.strictEqual(approvalRequests[0].intent, "request_approval");
    assert.strictEqual(approvalRequests[0].type, "telegram_message");
    assert.strictEqual(
        approvalRequests[0].message,
        result.steps[1].output.message
    );
    assert.deepStrictEqual(result.output, {
        type: "approval_request",
        status: "pending",
        content: result.steps[1].output.message
    });

    assert.strictEqual(registry.has("telegram_publisher"), false);
    assert.strictEqual(orchestrator.telegramService, undefined);
    assert.strictEqual(router.telegramService, undefined);
    console.log("Daily Performance workflow execution test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
