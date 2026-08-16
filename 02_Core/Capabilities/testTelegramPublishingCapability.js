const assert = require("assert");

const CapabilityRegistry = require("./capabilityRegistry");
const CapabilityGateway = require("./capabilityGateway");
const TelegramPublishingCapability = require("./telegramPublishingCapability");
const TaskEngine = require("../../01_Core/Task_Engine/02_taskEngine");
const PublishingAgentExecutor = require("../../01_Core/Task_Engine/05_publishingAgentExecutor");
const { RULE_MODES } = require("../../01_Core/Rule_Layer/01_ruleContracts");
const {
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    createCapabilityRequest,
    validateCapabilityResult
} = require("./capabilityContract");

async function run() {
    const publishedMessages = [];
    const ruleCalls = [];
    const publisher = {
        async publishContent(message) {
            publishedMessages.push(message);
            return {
                message_id: "mock-telegram-message-1",
                chat: { id: "mock-telegram-primary" }
            };
        }
    };
    const taskEngine = new TaskEngine({
        clock: createClock(),
        taskIdGenerator: () => "task-telegram-capability-1",
        resultIdGenerator: (() => {
            let id = 0;
            return () => `result-telegram-capability-${++id}`;
        })(),
        executors: {
            "publishing-agent": new PublishingAgentExecutor({
                publisherFactory: () => publisher
            })
        }
    });
    const capability = new TelegramPublishingCapability({
        taskEngine,
        ruleResolver: {
            resolve(action, scope) {
                ruleCalls.push({ action, scope });
                return { mode: RULE_MODES.AUTOMATIC, source: "rule", rule: { id: "rule-1" } };
            }
        }
    });

    assert.strictEqual(capability.declaration.behavior, CAPABILITY_BEHAVIORS.MUTATING);
    assert.strictEqual(capability.declaration.approvalRequirement, APPROVAL_REQUIREMENTS.REQUIRED);

    const registry = new CapabilityRegistry([capability]);
    const gateway = new CapabilityGateway({ registry, clock: createClock() });
    const request = createCapabilityRequest({
        requestId: "request-telegram-capability-1",
        capability: "publishing.telegram",
        operation: "publishing.telegram.publish",
        input: { message: "Swisschart capability publication proof" },
        context: {},
        constraints: {},
        metadata: {},
        requestedBy: "founder",
        source: "capability-test",
        timestamp: "2026-08-13T14:00:00.000Z",
        inputContractVersion: "1.0"
    });

    const pending = await gateway.execute(request);

    assert.strictEqual(validateCapabilityResult(pending).valid, true);
    assert.strictEqual(pending.status, "blocked");
    assert.strictEqual(pending.data.taskId, "task-telegram-capability-1");
    assert.strictEqual(pending.data.taskStatus, "blocked");
    assert.strictEqual(pending.data.approvalRequired, true);
    assert.strictEqual(pending.data.approvalStatus, "pending");
    assert.strictEqual(pending.data.blocker.code, "AWAITING_FOUNDER_APPROVAL");
    assert.strictEqual(pending.executionMetadata.behavior, "mutating");
    assert.strictEqual(pending.executionMetadata.approvalEnforcedBy, "capability_policy");
    assert.deepStrictEqual(ruleCalls, [{
        action: "publishing.publish",
        scope: { destination: "telegram.primary", contentType: "text" }
    }]);
    assert.strictEqual(publishedMessages.length, 0);

    const storedTask = taskEngine.tasks.get(pending.data.taskId);
    assert.strictEqual(storedTask.intent, "content.publish");
    assert.strictEqual(storedTask.capabilityRequirement, "publishing.publish");
    assert.strictEqual(storedTask.input.destination, "telegram.primary");

    taskEngine.founderApprovalController.approve(pending.data.taskId);
    const completed = await taskEngine.resumeApprovedTask(pending.data.taskId);

    assert.strictEqual(completed.task.status, "completed");
    assert.strictEqual(completed.result.status, "completed");
    assert.deepStrictEqual(publishedMessages, [request.input.message]);
    assert.strictEqual(completed.result.externalReferences[0].messageId,
        "mock-telegram-message-1");

    console.log("Telegram Publishing Capability integration test passed");
}

function createClock() {
    let tick = 0;
    return () => new Date(Date.UTC(2026, 7, 13, 14, 0, tick++));
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
