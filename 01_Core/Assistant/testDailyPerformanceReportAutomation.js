const assert = require("assert");

const AutomationManager = require("../Automation_Manager/automationManager");
const AutomationIntentHandler = require("./automationIntentHandler");

function run() {
    const automationManager = new AutomationManager();
    const intentHandler = new AutomationIntentHandler({
        automationManager,
        automationIdGenerator: () => "daily-performance-report"
    });

    const created = intentHandler.handle({
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
                    capabilityRequirement: "notion",
                    intent: "get_performance_summary",
                    input: {}
                },
                {
                    capabilityRequirement: "telegram_formatter",
                    intent: "format_performance_report"
                },
                {
                    capabilityRequirement: "founder_approval",
                    intent: "request_approval"
                },
                {
                    capabilityRequirement: "telegram_publisher",
                    intent: "publish"
                }
            ]
        },
        approvalPolicy: {
            required: true,
            status: "pending"
        },
        metadata: {
            createdBy: "founder",
            definitionStatus: "validation"
        }
    });

    assert.strictEqual(created.name, "Daily Performance Report");
    assert.deepStrictEqual(created.trigger, {
        type: "schedule",
        frequency: "daily",
        time: "08:00",
        timezone: "Europe/Istanbul"
    });
    assert.strictEqual(created.workflow.steps.length, 4);
    assert.deepStrictEqual(
        created.workflow.steps.map(step => [
            step.capabilityRequirement,
            step.intent
        ]),
        [
            ["notion", "get_performance_summary"],
            ["telegram_formatter", "format_performance_report"],
            ["founder_approval", "request_approval"],
            ["telegram_publisher", "publish"]
        ]
    );
    assert.strictEqual(created.approvalPolicy.required, true);
    assert.strictEqual(created.approvalPolicy.status, "pending");

    const stored = automationManager.getWorkflowAutomation(
        "daily-performance-report"
    );
    assert.deepStrictEqual(stored, created);

    assert.strictEqual(intentHandler.taskEngine, undefined);
    assert.strictEqual(intentHandler.orchestrator, undefined);
    assert.strictEqual(automationManager.execute, undefined);
    assert.strictEqual(automationManager.service, undefined);

    console.log("Daily Performance Report automation definition test passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
