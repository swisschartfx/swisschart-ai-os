const ApprovalGate = require("./01_approvalGate");

class ApprovalService {
    constructor(options = {}) {
        this.approvalGate = options.approvalGate || new ApprovalGate();
    }

    approveTask(task) {
        const updatedTask = this.approvalGate.approve(task);

        if (!this.approvalGate.canExecute(updatedTask)) {
            throw new Error("Approved task did not become executable");
        }

        return updatedTask;
    }

    rejectTask(task) {
        const updatedTask = this.approvalGate.reject(task);

        if (this.approvalGate.canExecute(updatedTask)) {
            throw new Error("Rejected task remained executable");
        }

        return updatedTask;
    }
}

module.exports = ApprovalService;
