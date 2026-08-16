const ApprovalGate = require("../Approval_Gate/01_approvalGate");

class FounderApprovalController {
    constructor(options = {}) {
        this.approvalGate = options.approvalGate || new ApprovalGate();
        this.clock = options.clock || (() => new Date());
        this.tasks = options.tasks || new Map();
    }

    registerTask(task) {
        if (!task || !task.taskId) {
            throw new Error("Task with taskId is required");
        }

        this.tasks.set(task.taskId, task);
        return task;
    }

    approve(taskId) {
        const task = this.requirePendingTask(taskId);
        this.approvalGate.approve(task);
        recordDecision(task, "approved", this.clock);
        return task;
    }

    reject(taskId) {
        const task = this.requirePendingTask(taskId);
        this.approvalGate.reject(task);
        recordDecision(task, "rejected", this.clock);
        return task;
    }

    canContinue(taskId) {
        const task = this.requireTask(taskId);
        return this.approvalGate.canExecute(task);
    }

    getTask(taskId) {
        return this.tasks.get(taskId) || null;
    }

    requireTask(taskId) {
        const task = this.tasks.get(taskId);

        if (!task) {
            const error = new Error(`Task ${taskId} was not found`);
            error.code = "APPROVAL_TASK_NOT_FOUND";
            throw error;
        }

        return task;
    }

    requirePendingTask(taskId) {
        const task = this.requireTask(taskId);

        if (!task.approval || task.approval.status !== "pending") {
            const error = new Error(`Task ${taskId} is not pending approval`);
            error.code = "APPROVAL_DECISION_NOT_PENDING";
            throw error;
        }

        return task;
    }
}

function recordDecision(task, status, clock) {
    task.approval.decisionBy = "founder";
    task.approval.decisionAt = clock().toISOString();
    task.approval.decision = status;
}

module.exports = FounderApprovalController;
