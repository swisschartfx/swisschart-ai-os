const {
    TASK_STATUSES,
    RESULT_STATUSES,
    createTask,
    validateTask,
    createResult
} = require("./04_taskContracts");

const {
    AGENT_REGISTRY,
    selectEligibleExecutor
} = require("./03_agentRegistry");

const PublishingAgentExecutor = require("./05_publishingAgentExecutor");
const AutomationExecutionRouter = require("./automationExecutionRouter");
const ApprovalGate = require("../Approval_Gate/01_approvalGate");
const FounderApprovalController = require("./founderApprovalController");

class TaskEngine {
    constructor(options = {}) {
        this.clock = options.clock || (() => new Date());
        this.taskIdGenerator = options.taskIdGenerator || (() => `task-${Date.now()}`);
        this.resultIdGenerator = options.resultIdGenerator || (() => `result-${Date.now()}`);
        this.registry = options.registry || AGENT_REGISTRY;
        this.selectExecutor = options.selectExecutor || selectEligibleExecutor;
        this.executors = options.executors || {
            "publishing-agent": new PublishingAgentExecutor()
        };
        this.approvalGate = options.approvalGate || new ApprovalGate();
        this.tasks = options.tasks || new Map();
        this.founderApprovalController = options.founderApprovalController ||
            new FounderApprovalController({
                approvalGate: this.approvalGate,
                clock: this.clock,
                tasks: this.tasks
            });
        this.automationExecutionRouter = options.automationExecutionRouter ||
            new AutomationExecutionRouter();
        this.automationManager = options.automationManager || null;
        this.automationOrchestrator = options.automationOrchestrator || null;
    }

    async execute(taskRequest) {
        const task = createTask(taskRequest, {
            clock: this.clock,
            idGenerator: this.taskIdGenerator
        });
        this.tasks.set(task.taskId, task);

        const validation = validateTask(task);
        task.validation = {
            status: validation.valid ? "passed" : "failed",
            errors: validation.errors
        };

        if (!validation.valid) {
            this.transition(task, TASK_STATUSES.VALIDATION_FAILED, "Task validation failed");
            task.terminalReason = TASK_STATUSES.VALIDATION_FAILED;
            task.completedAt = this.now();

            return this.finish(task, this.failureResult(task, "preflight", {
                code: "TASK_VALIDATION_FAILED",
                message: "Task validation failed",
                stage: "validation",
                details: validation.errors,
                retryEligible: false
            }));
        }

        this.transition(task, TASK_STATUSES.VALIDATED, "Task validation passed");

        if (!this.approvalGate.canExecute(task)) {
            const blocker = {
                code: task.approval.status === "rejected"
                    ? "APPROVAL_REJECTED"
                    : "AWAITING_FOUNDER_APPROVAL",
                message: task.approval.status === "rejected"
                    ? "Task execution was rejected by the founder"
                    : "Task requires founder approval before execution"
            };
            this.transition(task, TASK_STATUSES.BLOCKED, blocker.message);
            task.terminalReason = blocker.code;
            task.completedAt = this.now();

            return this.finish(task, this.blockedResult(task, blocker));
        }

        return this.executeApprovedTask(task);
    }

    async resumeApprovedTask(taskId) {
        const task = this.tasks.get(taskId);

        if (!task) {
            const error = new Error(`Task ${taskId} was not found`);
            error.code = "APPROVAL_TASK_NOT_FOUND";
            throw error;
        }

        if (!task.approval || task.approval.status !== "approved") {
            const error = new Error(`Task ${taskId} is not approved`);
            error.code = "APPROVAL_RESUME_NOT_APPROVED";
            throw error;
        }

        if (task.status !== TASK_STATUSES.BLOCKED ||
            task.terminalReason !== "AWAITING_FOUNDER_APPROVAL") {
            const error = new Error(`Task ${taskId} is not awaiting approval resume`);
            error.code = "APPROVAL_RESUME_INVALID_STATE";
            throw error;
        }

        task.terminalReason = null;
        task.completedAt = null;
        task.resultReference = null;
        this.transition(task, TASK_STATUSES.VALIDATED,
            "Founder approval recorded; Task execution resumed");

        return this.executeApprovedTask(task);
    }

    async executeApprovedTask(task) {

        if (isScheduledAutomationTask(task)) {
            return this.executeAutomationTask(task);
        }

        const selection = this.selectExecutor(task, this.registry);
        if (!selection.entry) {
            this.transition(task, TASK_STATUSES.BLOCKED, selection.blocker.message);
            task.terminalReason = selection.blocker.code;
            task.completedAt = this.now();

            return this.finish(task, this.blockedResult(task, selection.blocker));
        }

        this.transition(task, TASK_STATUSES.QUEUED, "Task queued for synchronous execution");
        task.assignment = {
            registryEntryId: selection.entry.registryEntryId,
            capabilityId: task.capabilityRequirement,
            executorType: selection.entry.executorType,
            executorId: selection.entry.executorId,
            assignedAt: this.now()
        };
        this.transition(task, TASK_STATUSES.ASSIGNED, "Task assigned through Agent Registry");

        const executor = this.executors[selection.entry.executorId];
        if (!executor || typeof executor.execute !== "function") {
            const blocker = {
                code: "EXECUTOR_UNAVAILABLE",
                message: "The selected executor is not available"
            };
            this.transition(task, TASK_STATUSES.BLOCKED, blocker.message);
            task.terminalReason = blocker.code;
            task.completedAt = this.now();
            return this.finish(task, this.blockedResult(task, blocker));
        }

        const attempt = {
            attemptId: `attempt-${task.attempts.length + 1}`,
            startedAt: this.now(),
            status: TASK_STATUSES.RUNNING
        };
        task.attempts.push(attempt);
        task.startedAt = attempt.startedAt;
        this.transition(task, TASK_STATUSES.RUNNING, "Executor started");

        try {
            const execution = await executor.execute({
                taskId: task.taskId,
                attemptId: attempt.attemptId,
                capabilityId: task.capabilityRequirement,
                action: "publishContent",
                message: task.input.message,
                destination: task.input.destination,
                constraints: task.constraints
            });

            attempt.status = TASK_STATUSES.COMPLETED;
            attempt.completedAt = this.now();
            this.transition(task, TASK_STATUSES.COMPLETED, "Executor returned a verified result");
            task.completedAt = this.now();

            return this.finish(task, createResult({
                taskId: task.taskId,
                attemptId: attempt.attemptId,
                status: RESULT_STATUSES.COMPLETED,
                summary: "Telegram publication completed with a verified message reference",
                executor: this.executorReference(selection.entry),
                output: execution.output,
                externalReferences: execution.externalReferences,
                evidence: execution.evidence
            }, this.resultOptions()));
        } catch (error) {
            attempt.status = TASK_STATUSES.FAILED;
            attempt.completedAt = this.now();
            this.transition(task, TASK_STATUSES.FAILED, "Executor returned an error");
            task.terminalReason = error.code || "EXECUTION_FAILED";
            task.completedAt = this.now();

            return this.finish(task, this.failureResult(task, attempt.attemptId, {
                code: error.code || "EXECUTION_FAILED",
                message: error.message || "Execution failed",
                stage: "execution",
                retryEligible: false
            }, selection.entry));
        }
    }

    async executeAutomationTask(task) {
        const workflowAutomation = this.automationManager &&
            typeof this.automationManager.getWorkflowAutomation === "function" &&
            task.input && task.input.automationId
            ? this.automationManager.getWorkflowAutomation(task.input.automationId)
            : null;
        const usesOrchestrator = Boolean(
            workflowAutomation &&
            this.automationOrchestrator &&
            typeof this.automationOrchestrator.execute === "function"
        );
        const executorId = usesOrchestrator
            ? "automation-orchestrator"
            : "automation-execution-router";

        this.transition(task, TASK_STATUSES.QUEUED,
            "Automation task queued for capability routing");
        task.assignment = {
            registryEntryId: null,
            capabilityId: task.capabilityRequirement,
            executorType: usesOrchestrator
                ? "automation_orchestrator"
                : "automation_router",
            executorId,
            assignedAt: this.now()
        };
        this.transition(task, TASK_STATUSES.ASSIGNED,
            `Task assigned to ${executorId}`);

        const attempt = {
            attemptId: `attempt-${task.attempts.length + 1}`,
            startedAt: this.now(),
            status: TASK_STATUSES.RUNNING
        };
        task.attempts.push(attempt);
        task.startedAt = attempt.startedAt;
        this.transition(task, TASK_STATUSES.RUNNING,
            `${executorId} started`);

        try {
            const capabilityResult = usesOrchestrator
                ? await this.automationOrchestrator.execute({
                    automationId: workflowAutomation.automationId,
                    steps: workflowAutomation.workflow.steps
                })
                : await this.automationExecutionRouter.execute({
                    action: {
                        capabilityRequirement: task.capabilityRequirement,
                        intent: task.intent,
                        input: task.input
                    }
                });

            if (capabilityResult && capabilityResult.status === "failed") {
                const error = new Error("Automation workflow execution failed");
                error.code = "AUTOMATION_WORKFLOW_FAILED";
                error.workflowResult = capabilityResult;
                throw error;
            }

            attempt.status = TASK_STATUSES.COMPLETED;
            attempt.completedAt = this.now();
            this.transition(task, TASK_STATUSES.COMPLETED,
                "Automation capability returned a result");
            task.completedAt = this.now();

            return this.finish(task, createResult({
                taskId: task.taskId,
                attemptId: attempt.attemptId,
                status: RESULT_STATUSES.COMPLETED,
                summary: "Automation capability execution completed",
                executor: {
                    capabilityId: task.capabilityRequirement,
                    executorId
                },
                output: capabilityResult
            }, this.resultOptions()));
        } catch (error) {
            attempt.status = TASK_STATUSES.FAILED;
            attempt.completedAt = this.now();
            this.transition(task, TASK_STATUSES.FAILED,
                "Automation capability returned an error");
            task.terminalReason = error.code || "AUTOMATION_EXECUTION_FAILED";
            task.completedAt = this.now();

            return this.finish(task, createResult({
                taskId: task.taskId,
                attemptId: attempt.attemptId,
                status: RESULT_STATUSES.FAILED,
                summary: error.message || "Automation execution failed",
                executor: {
                    capabilityId: task.capabilityRequirement,
                    executorId
                },
                output: error.workflowResult || null,
                error: {
                    code: error.code || "AUTOMATION_EXECUTION_FAILED",
                    message: error.message || "Automation execution failed",
                    stage: "execution",
                    retryEligible: false
                }
            }, this.resultOptions()));
        }
    }

    transition(task, status, note) {
        task.status = status;
        task.executionHistory.push({
            status,
            at: this.now(),
            note
        });
    }

    finish(task, result) {
        task.resultReference = result ? result.resultId : null;
        return { task, result };
    }

    blockedResult(task, blocker) {
        return createResult({
            taskId: task.taskId,
            attemptId: "preflight",
            status: RESULT_STATUSES.BLOCKED,
            summary: blocker.message,
            blocker,
            nextAction: "Resolve the blocker before requesting execution."
        }, this.resultOptions());
    }

    failureResult(task, attemptId, error, registryEntry = null) {
        return createResult({
            taskId: task.taskId,
            attemptId,
            status: RESULT_STATUSES.FAILED,
            summary: error.message,
            executor: registryEntry ? this.executorReference(registryEntry) : null,
            error
        }, this.resultOptions());
    }

    executorReference(entry) {
        return {
            registryEntryId: entry.registryEntryId,
            capabilityId: "publishing.publish",
            executorId: entry.executorId,
            version: entry.version
        };
    }

    resultOptions() {
        return {
            clock: this.clock,
            idGenerator: this.resultIdGenerator
        };
    }

    now() {
        return this.clock().toISOString();
    }
}

function isScheduledAutomationTask(task) {
    return task.source === "event" &&
        task.createdBy === "scheduler-runtime" &&
        task.capabilityRequirement === "automation_workflow";
}

module.exports = TaskEngine;
