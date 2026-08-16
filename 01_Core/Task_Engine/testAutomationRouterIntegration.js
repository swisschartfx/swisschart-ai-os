const assert = require("assert");

const TaskEngine = require("./02_taskEngine");
const ScheduledTaskEngineAdapter = require("./06_scheduledTaskEngineAdapter");

async function run() {
    const routerCalls = [];
    const router = {
        async execute(request) {
            routerCalls.push(request);

            if (request.action.intent === "fail_safely") {
                const error = new Error("Capability execution failed safely");
                error.code = "CAPABILITY_FAILED";
                throw error;
            }

            return {
                type: "capability_result",
                data: { count: 3 }
            };
        }
    };
    let taskId = 0;
    const taskEngine = new TaskEngine({
        automationExecutionRouter: router,
        taskIdGenerator: () => `automation-task-${++taskId}`,
        resultIdGenerator: () => `automation-result-${taskId}`
    });
    const scheduledAdapter = new ScheduledTaskEngineAdapter({ taskEngine });

    const completed = await scheduledAdapter.execute(
        createScheduledTaskRequest("scheduled-occurrence-1", "get_data")
    );
    assert.strictEqual(completed.task.taskId, "automation-task-1");
    assert.strictEqual(completed.task.source, "event");
    assert.strictEqual(completed.task.status, "completed");
    assert.strictEqual(completed.task.assignment.executorId,
        "automation-execution-router");
    assert.deepStrictEqual(routerCalls[0], {
        action: {
            capabilityRequirement: "generic_capability",
            intent: "get_data",
            input: { query: "configured query" }
        }
    });
    assert.deepStrictEqual(completed.result.output, {
        type: "capability_result",
        data: { count: 3 }
    });

    const failed = await scheduledAdapter.execute(
        createScheduledTaskRequest("scheduled-occurrence-2", "fail_safely")
    );
    assert.strictEqual(failed.task.status, "failed");
    assert.strictEqual(failed.task.terminalReason, "CAPABILITY_FAILED");
    assert.strictEqual(failed.result.status, "failed");
    assert.strictEqual(failed.result.error.retryEligible, false);

    console.log("Task Engine Automation Router integration test passed");
}

function createScheduledTaskRequest(idempotencyKey, intent) {
    return {
        source: "event",
        sourceReference: idempotencyKey,
        createdBy: "scheduler-runtime",
        intent,
        objective: "Execute a scheduled generic capability.",
        capabilityRequirement: "generic_capability",
        input: { query: "configured query" },
        priority: "normal",
        approval: {
            required: true,
            status: "approved"
        },
        idempotencyKey
    };
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
