const assert = require("assert");

const SwisschartAssistant = require("./01_assistant");
const AutomationManager = require("../Automation_Manager/automationManager");

async function run() {
    const notionCalls = [];
    const telegramCalls = [];
    const assistant = new SwisschartAssistant({
        testMode: true,
        taskEngine: {},
        ruleResolver: {},
        automationManager: new AutomationManager(),
        notionAgent: {
            async handleRequest(request) {
                notionCalls.push(request);
                return { type: "trade_history", status: "empty", count: 0 };
            }
        },
        telegramPublishingWorkflow: {
            async execute(task) {
                telegramCalls.push(task);
                return { mock: true };
            }
        }
    });
    const automation = {
        automationId: "assistant-automation-1",
        name: "Founder configured automation",
        enabled: true,
        trigger: { type: "schedule", expression: "0 8 * * *" },
        action: { capability: "generic.execute", input: {} },
        approvalPolicy: { required: true },
        metadata: { owner: "founder" }
    };

    const created = await assistant.handle({
        type: "automation",
        action: "create",
        automation
    });
    assert.strictEqual(created.automationId, "assistant-automation-1");

    const updated = await assistant.handle({
        type: "automation",
        action: "update",
        automationId: automation.automationId,
        updates: { name: "Updated automation" }
    });
    assert.strictEqual(updated.name, "Updated automation");

    const disabled = await assistant.handle({
        type: "automation",
        action: "disable",
        automationId: automation.automationId
    });
    assert.strictEqual(disabled.enabled, false);

    const enabled = await assistant.handle({
        type: "automation",
        action: "enable",
        automationId: automation.automationId
    });
    assert.strictEqual(enabled.enabled, true);

    const retrieved = await assistant.handle({
        type: "automation",
        action: "get",
        automationId: automation.automationId
    });
    assert.strictEqual(retrieved.name, "Updated automation");

    const notionResult = await assistant.handle({
        type: "notion",
        action: "getTradeHistory"
    });
    assert.strictEqual(notionResult.type, "trade_history");
    assert.strictEqual(notionCalls.length, 1);

    const telegramResult = await assistant.handle({
        type: "telegram_publish",
        task: { taskId: "telegram-regression" }
    });
    assert.strictEqual(telegramResult.mock, true);
    assert.strictEqual(telegramCalls.length, 1);

    const deleted = await assistant.handle({
        type: "automation",
        action: "delete",
        automationId: automation.automationId
    });
    assert.strictEqual(deleted, true);
    assert.strictEqual(await assistant.handle({
        type: "automation",
        action: "get",
        automationId: automation.automationId
    }), null);

    console.log("Assistant Automation Manager integration test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
