const assert = require("assert");

const AutomationManager = require("./automationManager");

function run() {
    const manager = new AutomationManager();
    const workflowAutomation = {
        automationId: "workflow-automation-1",
        name: "Generic multi-step automation",
        enabled: true,
        trigger: {
            type: "schedule",
            frequency: "daily",
            time: "08:00",
            timezone: "Europe/Istanbul"
        },
        workflow: {
            steps: [
                {
                    capabilityRequirement: "source_capability",
                    intent: "read",
                    input: { scope: "configured" }
                },
                {
                    capabilityRequirement: "transform_capability",
                    intent: "format"
                }
            ]
        },
        approvalPolicy: { required: true },
        metadata: { createdBy: "founder" }
    };

    const created = manager.createWorkflowAutomation(workflowAutomation);
    assert.strictEqual(created.workflow.steps.length, 2);

    const retrieved = manager.getWorkflowAutomation("workflow-automation-1");
    assert.deepStrictEqual(retrieved.workflow, workflowAutomation.workflow);

    const updated = manager.updateWorkflowAutomation(
        "workflow-automation-1",
        {
            steps: [
                ...workflowAutomation.workflow.steps,
                {
                    capabilityRequirement: "final_capability",
                    intent: "complete"
                }
            ]
        }
    );
    assert.strictEqual(updated.workflow.steps.length, 3);
    assert.strictEqual(
        updated.workflow.steps[2].capabilityRequirement,
        "final_capability"
    );

    const legacy = manager.createAutomation({
        automationId: "legacy-action-automation",
        name: "Legacy single action",
        enabled: true,
        trigger: { type: "schedule", executeAt: "2026-08-13T10:00:00.000Z" },
        action: {
            capabilityRequirement: "legacy_capability",
            intent: "execute",
            input: {}
        },
        approvalPolicy: { required: true },
        metadata: {}
    });
    assert.strictEqual(legacy.action.intent, "execute");
    assert.strictEqual(manager.getAutomation(legacy.automationId).action.intent,
        "execute");

    assert.strictEqual(manager.executionRouter, undefined);
    assert.strictEqual(manager.orchestrator, undefined);
    assert.strictEqual(manager.execute, undefined);
    console.log("Workflow Automation Manager test passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
