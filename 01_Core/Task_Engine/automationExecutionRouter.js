class AutomationExecutionRouter {
    constructor(options = {}) {
        this.capabilityRegistry = options.capabilityRegistry || null;
    }

    async execute(request) {
        const action = request && request.action;

        if (!action || typeof action !== "object") {
            throw new Error("Automation action is required");
        }

        const capability = this.capabilityRegistry &&
            typeof this.capabilityRegistry.get === "function"
            ? this.capabilityRegistry.get(action.capabilityRequirement)
            : null;

        if (!capability) {
            const error = new Error(
                `Unsupported automation capability: ${action.capabilityRequirement}`
            );
            error.code = "AUTOMATION_CAPABILITY_UNSUPPORTED";
            throw error;
        }

        if (typeof capability.execute !== "function") {
            const error = new Error(
                `Capability ${action.capabilityRequirement} is not executable`
            );
            error.code = "AUTOMATION_CAPABILITY_NOT_EXECUTABLE";
            throw error;
        }

        return capability.execute({
            intent: action.intent,
            ...(action.input || {})
        });
    }
}

module.exports = AutomationExecutionRouter;
