const AGENT_REGISTRY = Object.freeze([
    Object.freeze({
        registryEntryId: "agent.publishing.telegram.v1",
        displayName: "Publishing Agent",
        executorType: "agent",
        executorId: "publishing-agent",
        version: "1.0",
        status: "active",
        availability: true,
        ownerDomain: "publishing",
        capabilities: ["publishing.publish"],
        supportedIntents: ["content.publish"],
        description: "Publishes approved text content through the configured Telegram service.",
        exclusions: [
            "Does not interpret founder intent",
            "Does not choose an unapproved destination",
            "Does not change company policy"
        ],
        inputContract: {
            required: ["message", "destination", "contentType"],
            destination: "telegram.primary",
            contentType: "text"
        },
        resultContract: {
            requiresExternalReference: true,
            requiresTelegramMessageId: true
        },
        eligibilityRules: [
            "Task input is valid",
            "Founder approval is recorded",
            "Telegram service is configured"
        ],
        approvalPolicy: "founder_approval_required",
        riskLevel: "medium",
        dataAccess: ["approved_publication_content"],
        externalEffects: ["telegram_message_publish"],
        policyReferences: ["00_PROJECT_BRAIN/04_RULES.md"],
        dependencies: ["telegram-service"],
        executionMode: "synchronous",
        timeoutPolicy: "No automatic retry in v1",
        retryPolicy: "manual_verification_required",
        idempotencySupport: false
    })
]);

function selectEligibleExecutor(task, registry = AGENT_REGISTRY) {
    const entry = registry.find((candidate) => (
        candidate.status === "active" &&
        candidate.availability === true &&
        candidate.capabilities.includes(task.capabilityRequirement) &&
        candidate.supportedIntents.includes(task.intent)
    ));

    if (!entry) {
        return {
            entry: null,
            blocker: {
                code: "NO_ELIGIBLE_CAPABILITY",
                message: "No active Agent Registry entry can execute this Task"
            }
        };
    }

    return {
        entry,
        blocker: null
    };
}

module.exports = {
    AGENT_REGISTRY,
    selectEligibleExecutor
};
