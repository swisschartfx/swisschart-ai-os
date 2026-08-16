const { randomUUID } = require("crypto");

class AutomationIntentHandler {
    constructor(options = {}) {
        if (!options.automationManager) {
            throw new Error("Automation Intent Handler requires Automation Manager");
        }

        this.automationManager = options.automationManager;
        this.automationIdGenerator = options.automationIdGenerator ||
            (() => `automation-${randomUUID()}`);
    }

    handle(request) {
        if (!request || typeof request !== "object") {
            throw invalidIntent("Automation intent request is required");
        }

        if (request.intent === "automation.create") {
            return this.automationManager.createWorkflowAutomation({
                automationId: request.automationId || this.automationIdGenerator(),
                name: request.name,
                enabled: request.enabled !== false,
                trigger: request.trigger,
                workflow: request.workflow,
                approvalPolicy: request.approvalPolicy,
                metadata: request.metadata || {}
            });
        }

        if (request.intent === "automation.update") {
            return this.automationManager.updateAutomation(
                request.automationId,
                request.updates || {}
            );
        }

        if (request.intent === "automation.list") {
            return this.automationManager.getAutomations(
                request.filters || {}
            );
        }

        throw invalidIntent(`Unsupported automation intent: ${request.intent}`);
    }
}

function invalidIntent(message) {
    const error = new Error(message);
    error.code = "AUTOMATION_INTENT_UNSUPPORTED";
    return error;
}

module.exports = AutomationIntentHandler;
