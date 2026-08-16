const assert = require("assert");

const AutomationManager = require("./automationManager");

function run() {
    const manager = new AutomationManager();
    const created = manager.createAutomation({
        automationId: "automation-1",
        name: "Generic scheduled operation",
        enabled: true,
        trigger: {
            type: "schedule",
            expression: "0 9 * * *"
        },
        action: {
            capability: "generic.execute",
            input: { value: "configured data" }
        },
        approvalPolicy: {
            required: true
        },
        metadata: {
            createdBy: "founder"
        }
    });

    assert.strictEqual(created.automationId, "automation-1");
    assert.strictEqual(manager.getAutomation("automation-1").enabled, true);

    const updated = manager.updateAutomation("automation-1", {
        name: "Updated generic operation",
        metadata: { createdBy: "founder", version: 2 }
    });
    assert.strictEqual(updated.name, "Updated generic operation");
    assert.strictEqual(updated.metadata.version, 2);

    const disabled = manager.disableAutomation("automation-1");
    assert.strictEqual(disabled.enabled, false);
    assert.strictEqual(manager.getAutomation("automation-1").enabled, false);

    const enabled = manager.enableAutomation("automation-1");
    assert.strictEqual(enabled.enabled, true);

    assert.strictEqual(manager.deleteAutomation("automation-1"), true);
    assert.strictEqual(manager.getAutomation("automation-1"), null);

    console.log("Automation Manager tests passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
