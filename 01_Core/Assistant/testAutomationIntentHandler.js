const assert = require("assert");

const AutomationManager = require("../Automation_Manager/automationManager");
const AutomationIntentHandler = require("./automationIntentHandler");

function run() {
    const manager = new AutomationManager();
    const handler = new AutomationIntentHandler({
        automationManager: manager,
        automationIdGenerator: () => "intent-automation-1"
    });
    const created = handler.handle({
        intent: "automation.create",
        name: "Daily Performance Report",
        trigger: {
            type: "schedule",
            frequency: "daily",
            time: "08:00",
            timezone: "Europe/Istanbul"
        },
        workflow: {
            steps: [
                {
                    capabilityRequirement: "data_source",
                    intent: "get_performance_summary",
                    input: {}
                },
                {
                    capabilityRequirement: "formatter",
                    intent: "format"
                }
            ]
        },
        approvalPolicy: { required: true },
        metadata: { source: "founder_intent" }
    });

    assert.strictEqual(created.automationId, "intent-automation-1");
    assert.strictEqual(created.workflow.steps.length, 2);
    assert.strictEqual(created.trigger.time, "08:00");

    const updated = handler.handle({
        intent: "automation.update",
        automationId: "intent-automation-1",
        updates: {
            workflow: {
                steps: [{
                    capabilityRequirement: "updated_capability",
                    intent: "updated_intent",
                    input: { configured: true }
                }]
            }
        }
    });
    assert.strictEqual(
        updated.workflow.steps[0].capabilityRequirement,
        "updated_capability"
    );

    const listed = handler.handle({ intent: "automation.list" });
    assert.strictEqual(listed.length, 1);
    assert.strictEqual(listed[0].automationId, "intent-automation-1");

    assert.throws(
        () => handler.handle({ intent: "automation.execute" }),
        error => error.code === "AUTOMATION_INTENT_UNSUPPORTED"
    );

    assert.strictEqual(handler.taskEngine, undefined);
    assert.strictEqual(handler.orchestrator, undefined);
    assert.strictEqual(handler.execute, undefined);
    console.log("Automation Intent Handler test passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
