const assert = require("assert");

const ApprovalGate = require("./01_approvalGate");
const ApprovalService = require("./02_approvalService");

function createPendingTask(id) {
    return {
        taskId: id,
        approval: {
            required: true,
            status: "pending"
        }
    };
}

function run() {
    const approvalGate = new ApprovalGate();
    const approvalService = new ApprovalService({ approvalGate });

    const approvedTask = approvalService.approveTask(
        createPendingTask("task-approve")
    );
    assert.strictEqual(approvedTask.approval.status, "approved");
    assert.strictEqual(approvalGate.canExecute(approvedTask), true);

    const rejectedTask = approvalService.rejectTask(
        createPendingTask("task-reject")
    );
    assert.strictEqual(rejectedTask.approval.status, "rejected");
    assert.strictEqual(approvalGate.canExecute(rejectedTask), false);

    console.log("Approval Service tests passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
