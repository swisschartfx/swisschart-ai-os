const AutomationStore = require("./automationStore");

class AutomationManager {
    constructor(options = {}) {
        this.automationStore = options.automationStore === null
            ? null
            : options.automationStore || new AutomationStore();
        const storedAutomations = this.automationStore
            ? this.automationStore.load()
            : [];
        this.automations = new Map(storedAutomations.map(automation => [
            automation.automationId,
            cloneAutomation(automation)
        ]));
    }

    createAutomation(automation) {
        validateAutomation(automation);

        if (this.automations.has(automation.automationId)) {
            throw new Error(`Automation ${automation.automationId} already exists`);
        }

        const stored = cloneAutomation({
            automationId: automation.automationId,
            name: automation.name,
            enabled: automation.enabled === true,
            trigger: automation.trigger,
            ...(automation.action ? { action: automation.action } : {}),
            ...(automation.workflow ? { workflow: automation.workflow } : {}),
            approvalPolicy: automation.approvalPolicy,
            metadata: automation.metadata || {}
        });

        if (this.automationStore) {
            this.automationStore.create(stored);
        }
        this.automations.set(stored.automationId, stored);
        return cloneAutomation(stored);
    }

    createWorkflowAutomation(automation) {
        if (!automation || !automation.workflow) {
            throw new Error("Workflow automation requires workflow");
        }

        return this.createAutomation(automation);
    }

    getWorkflowAutomation(automationId) {
        const automation = this.getAutomation(automationId);
        return automation && automation.workflow ? automation : null;
    }

    updateWorkflowAutomation(automationId, workflow) {
        if (!workflow) {
            throw new Error("Workflow automation update requires workflow");
        }

        return this.updateAutomation(automationId, { workflow });
    }

    updateAutomation(automationId, updates) {
        const existing = this.requireAutomation(automationId);
        const updated = {
            ...existing,
            ...updates,
            automationId
        };

        validateAutomation(updated);
        const stored = cloneAutomation(updated);
        if (this.automationStore) {
            this.automationStore.update(automationId, stored);
        }
        this.automations.set(automationId, stored);
        return cloneAutomation(stored);
    }

    enableAutomation(automationId) {
        return this.updateAutomation(automationId, { enabled: true });
    }

    disableAutomation(automationId) {
        return this.updateAutomation(automationId, { enabled: false });
    }

    deleteAutomation(automationId) {
        const deleted = this.automations.delete(automationId);

        if (deleted && this.automationStore) {
            this.automationStore.delete(automationId);
        }

        return deleted;
    }

    getAutomation(automationId) {
        const automation = this.automations.get(automationId);
        return automation ? cloneAutomation(automation) : null;
    }

    getAutomations(options = {}) {
        return Array.from(this.automations.values())
            .filter(automation => options.enabled === undefined ||
                automation.enabled === options.enabled)
            .map(cloneAutomation);
    }

    requireAutomation(automationId) {
        const automation = this.automations.get(automationId);

        if (!automation) {
            throw new Error(`Automation ${automationId} was not found`);
        }

        return automation;
    }
}

function validateAutomation(automation) {
    if (!automation || typeof automation !== "object") {
        throw new Error("Automation is required");
    }

    for (const field of [
        "automationId",
        "name",
        "trigger",
        "approvalPolicy"
    ]) {
        if (!automation[field]) {
            throw new Error(`Automation ${field} is required`);
        }
    }

    if (typeof automation.enabled !== "boolean") {
        throw new Error("Automation enabled must be a boolean");
    }

    if (!automation.action && !automation.workflow) {
        throw new Error("Automation action or workflow is required");
    }

    if (automation.workflow) {
        validateWorkflow(automation.workflow);
    }
}

function validateWorkflow(workflow) {
    if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
        throw new Error("Automation workflow requires at least one step");
    }

    workflow.steps.forEach((step, index) => {
        if (!step || !step.capabilityRequirement || !step.intent) {
            throw new Error(
                `Automation workflow step ${index + 1} requires capabilityRequirement and intent`
            );
        }
    });
}

function cloneAutomation(automation) {
    return structuredClone(automation);
}

module.exports = AutomationManager;
