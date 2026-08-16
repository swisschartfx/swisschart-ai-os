const assert = require("assert");

const ApprovalGate = require("./01_approvalGate");

function createTask(required = true, status = "pending") {
    return {
        taskId: "task-approval-test",
        approval: {
            required,
            status
        }
    };
}

function run() {
    const approvalGate = new ApprovalGate();

    const pendingTask = createTask(true, "pending");
    assert.strictEqual(approvalGate.canExecute(pendingTask), false);

    approvalGate.approve(pendingTask);
    assert.strictEqual(pendingTask.approval.status, "approved");
    assert.strictEqual(approvalGate.canExecute(pendingTask), true);

    const rejectedTask = createTask(true, "pending");
    approvalGate.reject(rejectedTask);
    assert.strictEqual(rejectedTask.approval.status, "rejected");
    assert.strictEqual(approvalGate.canExecute(rejectedTask), false);

    const approvalNotRequiredTask = createTask(false, "not_required");
    assert.strictEqual(approvalGate.canExecute(approvalNotRequiredTask), true);

    console.log("Approval Gate tests passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
