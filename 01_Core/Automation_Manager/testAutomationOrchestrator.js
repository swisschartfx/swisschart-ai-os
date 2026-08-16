const assert = require("assert");

const AutomationOrchestrator = require("./automationOrchestrator");

async function run() {
    const calls = [];
    const executionRouter = {
        async execute(request) {
            calls.push(request);
            const capability = request.action.capabilityRequirement;

            if (capability === "source") {
                return { type: "source_result", data: { value: 42 } };
            }

            if (capability === "transform") {
                return {
                    type: "transformed_result",
                    received: request.action.input
                };
            }

            if (capability === "failure") {
                const error = new Error("Configured capability failed");
                error.code = "CONFIGURED_FAILURE";
                throw error;
            }

            const error = new Error(`Unknown capability: ${capability}`);
            error.code = "AUTOMATION_CAPABILITY_UNSUPPORTED";
            throw error;
        }
    };
    const orchestrator = new AutomationOrchestrator({ executionRouter });

    const completed = await orchestrator.execute({
        automationId: "two-step-automation",
        steps: [
            {
                capabilityRequirement: "source",
                intent: "read",
                input: { query: "configured" }
            },
            {
                capabilityRequirement: "transform",
                intent: "format"
            }
        ]
    });
    assert.strictEqual(completed.status, "completed");
    assert.strictEqual(completed.steps.length, 2);
    assert.deepStrictEqual(calls[1].action.input, {
        type: "source_result",
        data: { value: 42 }
    });
    assert.deepStrictEqual(completed.output.received, calls[0]
        ? { type: "source_result", data: { value: 42 } }
        : null);

    const callsBeforeFailure = calls.length;
    const failed = await orchestrator.execute({
        automationId: "failed-automation",
        steps: [
            { capabilityRequirement: "failure", intent: "execute" },
            { capabilityRequirement: "transform", intent: "must_not_run" }
        ]
    });
    assert.strictEqual(failed.status, "failed");
    assert.strictEqual(failed.failedStep, 1);
    assert.strictEqual(failed.steps[0].error.code, "CONFIGURED_FAILURE");
    assert.strictEqual(calls.length, callsBeforeFailure + 1);

    const unknown = await orchestrator.execute({
        automationId: "unknown-automation",
        steps: [
            { capabilityRequirement: "unknown", intent: "execute" }
        ]
    });
    assert.strictEqual(unknown.status, "failed");
    assert.strictEqual(
        unknown.steps[0].error.code,
        "AUTOMATION_CAPABILITY_UNSUPPORTED"
    );

    assert.strictEqual(orchestrator.scheduler, undefined);
    assert.strictEqual(orchestrator.approvalGate, undefined);
    assert.strictEqual(orchestrator.publisher, undefined);
    console.log("Automation Orchestrator test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
