const assert = require("assert");

const FounderApprovalController = require("./founderApprovalController");

function run() {
    const controller = new FounderApprovalController({
        clock: () => new Date("2026-08-12T12:00:00.000Z")
    });
    const approvalTask = createPendingTask("task-approve");
    const rejectionTask = createPendingTask("task-reject");
    controller.registerTask(approvalTask);
    controller.registerTask(rejectionTask);

    assert.strictEqual(controller.canContinue("task-approve"), false);
    const approved = controller.approve("task-approve");
    assert.strictEqual(approved.approval.status, "approved");
    assert.strictEqual(approved.approval.decisionBy, "founder");
    assert.strictEqual(controller.canContinue("task-approve"), true);

    const rejected = controller.reject("task-reject");
    assert.strictEqual(rejected.approval.status, "rejected");
    assert.strictEqual(controller.canContinue("task-reject"), false);

    assert.throws(
        () => controller.approve("unknown-task"),
        error => error.code === "APPROVAL_TASK_NOT_FOUND"
    );

    console.log("Founder Approval Controller test passed");
}

function createPendingTask(taskId) {
    return {
        taskId,
        approval: {
            required: true,
            status: "pending"
        }
    };
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
