class ScheduledTaskEngineAdapter {
    constructor(options = {}) {
        if (!options.taskEngine ||
            typeof options.taskEngine.execute !== "function") {
            throw new Error("Scheduled Task Engine Adapter requires Task Engine");
        }

        this.taskEngine = options.taskEngine;
        this.executions = new Map();
    }

    async execute(taskRequest) {
        const key = taskRequest && taskRequest.idempotencyKey;

        if (!key) {
            throw new Error("Scheduled task requires an idempotencyKey");
        }

        if (!this.executions.has(key)) {
            this.executions.set(key, this.taskEngine.execute(taskRequest));
        }

        return this.executions.get(key);
    }
}

module.exports = ScheduledTaskEngineAdapter;
