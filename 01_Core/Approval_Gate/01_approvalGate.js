class ApprovalGate {
    approve(task) {
        const approval = getApproval(task);
        approval.status = "approved";
        return task;
    }

    reject(task) {
        const approval = getApproval(task);
        approval.status = "rejected";
        return task;
    }

    canExecute(task) {
        const approval = getApproval(task);

        if (approval.status === "rejected") {
            return false;
        }

        if (approval.required === true) {
            return approval.status === "approved";
        }

        return true;
    }
}

function getApproval(task) {
    if (!task || typeof task !== "object") {
        throw new Error("task is required");
    }

    if (!task.approval || typeof task.approval !== "object") {
        throw new Error("task.approval is required");
    }

    return task.approval;
}

module.exports = ApprovalGate;
