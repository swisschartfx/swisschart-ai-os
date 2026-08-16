const assert = require("assert");

const AutomationOrchestrator = require("./automationOrchestrator");
const AutomationExecutionRouter = require("../Task_Engine/automationExecutionRouter");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");

async function run() {
    const calls = [];
    const registry = new CapabilityRegistry([
        {
            name: "source_capability",
            async execute(request) {
                calls.push({ capability: this.name, request });
                return { type: "source_result", value: 21 };
            }
        },
        {
            name: "transform_capability",
            async execute(request) {
                calls.push({ capability: this.name, request });
                return {
                    type: "transformed_result",
                    value: request.value * 2
                };
            }
        },
        {
            name: "failed_capability",
            async execute(request) {
                calls.push({ capability: this.name, request });
                const error = new Error("Capability failed safely");
                error.code = "CAPABILITY_FAILED";
                throw error;
            }
        }
    ]);
    const router = new AutomationExecutionRouter({
        capabilityRegistry: registry
    });
    const orchestrator = new AutomationOrchestrator({
        executionRouter: router
    });

    const completed = await orchestrator.execute({
        automationId: "router-workflow-success",
        steps: [
            {
                capabilityRequirement: "source_capability",
                intent: "read",
                input: { source: "configured" }
            },
            {
                capabilityRequirement: "transform_capability",
                intent: "transform"
            }
        ]
    });
    assert.strictEqual(completed.status, "completed");
    assert.deepStrictEqual(calls.map(call => call.capability), [
        "source_capability",
        "transform_capability"
    ]);
    assert.deepStrictEqual(calls[1].request, {
        intent: "transform",
        type: "source_result",
        value: 21
    });
    assert.deepStrictEqual(completed.output, {
        type: "transformed_result",
        value: 42
    });

    const callsBeforeFailure = calls.length;
    const failed = await orchestrator.execute({
        automationId: "router-workflow-failure",
        steps: [
            {
                capabilityRequirement: "failed_capability",
                intent: "fail"
            },
            {
                capabilityRequirement: "transform_capability",
                intent: "must_not_run"
            }
        ]
    });
    assert.strictEqual(failed.status, "failed");
    assert.strictEqual(failed.failedStep, 1);
    assert.strictEqual(failed.steps[0].error.code, "CAPABILITY_FAILED");
    assert.strictEqual(calls.length, callsBeforeFailure + 1);

    assert.strictEqual(orchestrator.capabilityRegistry, undefined);
    assert.strictEqual(orchestrator.capability, undefined);
    console.log("Orchestrator Router integration test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
