class AutomationOrchestrator {
    constructor(options = {}) {
        if (!options.executionRouter ||
            typeof options.executionRouter.execute !== "function") {
            throw new Error("Automation Orchestrator requires an Execution Router");
        }

        this.executionRouter = options.executionRouter;
    }

    async execute(workflow) {
        validateWorkflow(workflow);

        const stepResults = [];
        let previousOutput;

        for (let index = 0; index < workflow.steps.length; index += 1) {
            const step = workflow.steps[index];
            const input = step.input !== undefined
                ? step.input
                : previousOutput === undefined
                    ? {}
                    : previousOutput;

            try {
                const output = await this.executionRouter.execute({
                    action: {
                        capabilityRequirement: step.capabilityRequirement,
                        intent: step.intent,
                        input
                    }
                });

                stepResults.push({
                    step: index + 1,
                    capabilityRequirement: step.capabilityRequirement,
                    intent: step.intent,
                    status: "completed",
                    output
                });
                previousOutput = output;
            } catch (error) {
                stepResults.push({
                    step: index + 1,
                    capabilityRequirement: step.capabilityRequirement,
                    intent: step.intent,
                    status: "failed",
                    error: {
                        code: error.code || "AUTOMATION_STEP_FAILED",
                        message: error.message || "Automation step failed"
                    }
                });

                return {
                    type: "automation_workflow_result",
                    automationId: workflow.automationId,
                    status: "failed",
                    failedStep: index + 1,
                    steps: stepResults,
                    output: null
                };
            }
        }

        return {
            type: "automation_workflow_result",
            automationId: workflow.automationId,
            status: "completed",
            steps: stepResults,
            output: previousOutput
        };
    }
}

function validateWorkflow(workflow) {
    if (!workflow || typeof workflow !== "object") {
        throw new Error("Automation workflow is required");
    }

    if (!workflow.automationId) {
        throw new Error("Automation workflow automationId is required");
    }

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

module.exports = AutomationOrchestrator;
