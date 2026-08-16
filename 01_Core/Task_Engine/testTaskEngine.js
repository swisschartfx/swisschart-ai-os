const assert = require("assert");

const TaskEngine = require("./02_taskEngine");
const PublishingAgentExecutor = require("./05_publishingAgentExecutor");

function createClock() {
    let tick = 0;
    return () => new Date(Date.UTC(2026, 7, 12, 0, 0, tick++));
}

function approvedRequest(overrides = {}) {
    return {
        source: "founder",
        sourceReference: "founder-request-1",
        createdBy: "assistant-core",
        intent: "content.publish",
        objective: "Publish approved Telegram content",
        capabilityRequirement: "publishing.publish",
        input: {
            message: "Approved Swisschart update",
            destination: "telegram.primary",
            contentType: "text"
        },
        approval: {
            required: true,
            status: "approved",
            decisionBy: "founder"
        },
        idempotencyKey: "approved-update-1",
        ...overrides
    };
}

async function run() {
    let publishedMessage = null;
    let publishCallCount = 0;
    const publisher = {
        async publishContent(message) {
            publishCallCount += 1;
            publishedMessage = message;
            return {
                message_id: 12345,
                chat: { id: -1001234567890 }
            };
        }
    };

    const executor = new PublishingAgentExecutor({
        publisherFactory: () => publisher
    });
    const engine = new TaskEngine({
        clock: createClock(),
        taskIdGenerator: () => "task-1",
        resultIdGenerator: () => "result-1",
        executors: {
            "publishing-agent": executor
        }
    });

    const completed = await engine.execute(approvedRequest());
    assert.strictEqual(completed.task.status, "completed");
    assert.strictEqual(completed.result.status, "completed");
    assert.strictEqual(completed.result.externalReferences[0].messageId, 12345);
    assert.strictEqual(publishedMessage, "Approved Swisschart update");
    assert.strictEqual(publishCallCount, 1);
    assert.strictEqual(completed.task.attempts.length, 1);

    const noApproval = await engine.execute(approvedRequest({
        approval: { required: true, status: "pending" }
    }));
    assert.strictEqual(noApproval.task.status, "blocked");
    assert.strictEqual(noApproval.result.status, "blocked");
    assert.strictEqual(
        noApproval.result.blocker.code,
        "AWAITING_FOUNDER_APPROVAL"
    );
    assert.strictEqual(noApproval.task.attempts.length, 0);
    assert.strictEqual(publishCallCount, 1);

    const invalid = await engine.execute(approvedRequest({
        input: {
            message: "",
            destination: "telegram.primary",
            contentType: "text"
        }
    }));
    assert.strictEqual(invalid.task.status, "validation_failed");
    assert.strictEqual(invalid.result.error.code, "TASK_VALIDATION_FAILED");

    const noExecutor = new TaskEngine({
        clock: createClock(),
        executors: {}
    });
    const blocked = await noExecutor.execute(approvedRequest());
    assert.strictEqual(blocked.task.status, "blocked");
    assert.strictEqual(blocked.result.status, "blocked");
    assert.strictEqual(blocked.result.blocker.code, "EXECUTOR_UNAVAILABLE");

    const failingExecutor = {
        async execute() {
            const error = new Error("Telegram network response was not verified");
            error.code = "TELEGRAM_DELIVERY_UNVERIFIED";
            throw error;
        }
    };
    const failingEngine = new TaskEngine({
        clock: createClock(),
        executors: { "publishing-agent": failingExecutor }
    });
    const failed = await failingEngine.execute(approvedRequest());
    assert.strictEqual(failed.task.status, "failed");
    assert.strictEqual(failed.result.status, "failed");
    assert.strictEqual(failed.result.error.retryEligible, false);
    assert.strictEqual(failed.task.attempts.length, 1);

    const unverifiedExecutor = new PublishingAgentExecutor({
        publisherFactory: () => ({
            async publishContent() {
                return { chat: { id: -1001234567890 } };
            }
        })
    });
    await assert.rejects(
        () => unverifiedExecutor.execute({
            action: "publishContent",
            message: "Approved Swisschart update",
            destination: "telegram.primary"
        }),
        (error) => error.code === "TELEGRAM_RESPONSE_UNVERIFIED"
    );

    console.log("Task Engine mock tests passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
