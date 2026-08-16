const assert = require("assert");

const AutomationManager = require("../Automation_Manager/automationManager");
const AutomationOrchestrator = require("../Automation_Manager/automationOrchestrator");
const AutomationSchedulerBridge = require("../Scheduler/automationSchedulerBridge");
const SchedulerRuntime = require("../Scheduler/schedulerRuntime");
const { createScheduledTaskRule } = require("../Scheduler/scheduledEventHandler");
const ScheduledTaskEngineAdapter = require("./06_scheduledTaskEngineAdapter");
const TaskEngine = require("./02_taskEngine");
const EventEngine = require("../Event_Engine/03_eventEngine");

async function run() {
    const now = new Date("2026-08-12T05:01:00.000Z");
    const manager = new AutomationManager();
    manager.createWorkflowAutomation(createWorkflow("workflow-success", false));
    manager.createWorkflowAutomation(createWorkflow("workflow-failure", true));

    const routerCalls = [];
    const executionRouter = {
        async execute(request) {
            routerCalls.push(request);

            if (request.action.capabilityRequirement === "source") {
                return { type: "source_result", value: 7 };
            }

            if (request.action.capabilityRequirement === "failure") {
                const error = new Error("Second step failed");
                error.code = "STEP_FAILED";
                throw error;
            }

            return {
                type: "transformed_result",
                received: request.action.input
            };
        }
    };
    const orchestrator = new AutomationOrchestrator({ executionRouter });
    let taskId = 0;
    const taskEngine = new TaskEngine({
        clock: () => now,
        taskIdGenerator: () => `workflow-task-${++taskId}`,
        resultIdGenerator: () => `workflow-result-${taskId}`,
        automationManager: manager,
        automationOrchestrator: orchestrator
    });
    const eventEngine = new EventEngine({
        clock: () => now,
        eventIdGenerator: (() => {
            let eventId = 0;
            return () => `workflow-event-${++eventId}`;
        })(),
        taskEngine: new ScheduledTaskEngineAdapter({ taskEngine }),
        rules: [createScheduledTaskRule()]
    });
    const bridge = new AutomationSchedulerBridge({
        automationManager: manager,
        clock: () => now
    });
    const runtime = new SchedulerRuntime({
        eventEngine,
        clock: () => now,
        getScheduledEvents: () => bridge.getScheduledEvents()
    });

    const scheduled = await runtime.tick();
    assert.strictEqual(scheduled.length, 2);
    assert.strictEqual(scheduled[0].taskExecutions[0].execution.task.status,
        "blocked");
    assert.strictEqual(routerCalls.length, 0);

    const successRequest = scheduled
        .find(item => item.event.metadata.automationId === "workflow-success")
        .taskExecutions[0].taskRequest;
    const success = await taskEngine.execute({
        ...successRequest,
        approval: { required: true, status: "approved" },
        idempotencyKey: "approved-workflow-success"
    });
    assert.strictEqual(success.task.status, "completed");
    assert.strictEqual(success.task.assignment.executorId,
        "automation-orchestrator");
    assert.strictEqual(success.result.output.steps.length, 2);
    assert.deepStrictEqual(routerCalls[1].action.input, {
        type: "source_result",
        value: 7
    });

    const failureRequest = scheduled
        .find(item => item.event.metadata.automationId === "workflow-failure")
        .taskExecutions[0].taskRequest;
    const callsBeforeFailure = routerCalls.length;
    const failure = await taskEngine.execute({
        ...failureRequest,
        approval: { required: true, status: "approved" },
        idempotencyKey: "approved-workflow-failure"
    });
    assert.strictEqual(failure.task.status, "failed");
    assert.strictEqual(failure.task.terminalReason,
        "AUTOMATION_WORKFLOW_FAILED");
    assert.strictEqual(failure.result.output.failedStep, 2);
    assert.strictEqual(routerCalls.length, callsBeforeFailure + 2);

    console.log("Workflow Automation Task integration test passed");
}

function createWorkflow(automationId, fails) {
    return {
        automationId,
        name: automationId,
        enabled: true,
        trigger: {
            type: "schedule",
            frequency: "daily",
            time: "08:00",
            timezone: "Europe/Istanbul"
        },
        workflow: {
            steps: [
                { capabilityRequirement: "source", intent: "read", input: {} },
                {
                    capabilityRequirement: fails ? "failure" : "transform",
                    intent: "process"
                },
                ...(fails
                    ? [{ capabilityRequirement: "must_not_run", intent: "skip" }]
                    : [])
            ]
        },
        approvalPolicy: { required: true },
        metadata: {}
    };
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
