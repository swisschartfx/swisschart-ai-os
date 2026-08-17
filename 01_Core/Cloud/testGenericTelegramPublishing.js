const assert = require("assert");

const GenericTelegramPublishCoordinator =
    require("./genericTelegramPublishCoordinator");

function createStore(seed = []) {
    let data = JSON.parse(JSON.stringify(seed));

    return {
        load() {
            return JSON.parse(JSON.stringify(data));
        },
        save(actions) {
            data = JSON.parse(JSON.stringify(actions));
        },
        snapshot() {
            return JSON.parse(JSON.stringify(data));
        }
    };
}

function createHarness(options = {}) {
    const tasks = new Map();
    const approved = new Set();
    let taskCounter = 0;
    let sendCount = 0;

    const assistant = {
        async handle(request) {
            assert.strictEqual(request.capability, "publishing.telegram");
            assert.strictEqual(
                request.operation,
                "publishing.telegram.publish"
            );

            const taskId = `task-${++taskCounter}`;

            tasks.set(taskId, {
                id: taskId,
                input: {
                    message: request.input.message,
                    destination: "telegram.primary",
                    contentType: "text"
                }
            });

            return {
                status: "blocked",
                data: {
                    taskId,
                    approvalStatus: "pending"
                }
            };
        }
    };

    const founderApprovalController = {
        getTask(taskId) {
            return tasks.get(taskId);
        },
        approve(taskId) {
            approved.add(taskId);
        }
    };

    const taskEngine = {
        founderApprovalController,

        async resumeApprovedTask(taskId) {
            assert(approved.has(taskId));
            sendCount += 1;

            if (options.throwOnExecution) {
                const error = new Error("TELEGRAM_SEND_FAILED");
                error.code = "TELEGRAM_SEND_FAILED";
                throw error;
            }

            if (options.noMessageId) {
                return {
                    result: {
                        status: "completed",
                        externalReferences: [{
                            chatId: "-100123"
                        }]
                    }
                };
            }

            return {
                result: {
                    status: "completed",
                    externalReferences: [{
                        messageId: 777,
                        chatId: "-100123"
                    }]
                }
            };
        }
    };

    return {
        assistant,
        taskEngine,
        tasks,
        getSendCount: () => sendCount
    };
}

async function expectCode(promise, code) {
    await assert.rejects(
        promise,
        (error) => error && error.code === code
    );
}

async function testPrepareApprovalAndReplay() {
    const store = createStore();
    const harness = createHarness();

    const coordinator = new GenericTelegramPublishCoordinator({
        assistant: harness.assistant,
        taskEngine: harness.taskEngine,
        store
    });

    const prepared = await coordinator.prepare({
        content: "Swisschart generic Telegram test"
    }, "req-1");

    assert.strictEqual(prepared.status, "pending_approval");
    assert.strictEqual(prepared.approvalRequired, true);
    assert.strictEqual(prepared.content,
        "Swisschart generic Telegram test");
    assert.strictEqual(prepared.destination, "telegram.primary");
    assert.strictEqual(prepared.contentType, "text");
    assert.strictEqual(prepared.format, "HTML");
    assert.strictEqual(harness.getSendCount(), 0);

    const duplicate = await coordinator.prepare({
        content: "Swisschart generic Telegram test"
    }, "req-2");

    assert.strictEqual(
        duplicate.approvalId,
        prepared.approvalId
    );
    assert.strictEqual(harness.getSendCount(), 0);

    await expectCode(
        coordinator.approve({
            approvalId: prepared.approvalId,
            payloadHash: prepared.payloadHash,
            confirm: false
        }),
        "GENERIC_TELEGRAM_EXPLICIT_APPROVAL_REQUIRED"
    );

    await expectCode(
        coordinator.approve({
            approvalId: prepared.approvalId,
            payloadHash: "wrong-hash",
            confirm: true
        }),
        "GENERIC_TELEGRAM_PAYLOAD_CHANGED_REAPPROVAL_REQUIRED"
    );

    assert.strictEqual(harness.getSendCount(), 0);

    const approved = await coordinator.approve({
        approvalId: prepared.approvalId,
        payloadHash: prepared.payloadHash,
        confirm: true
    });

    assert.strictEqual(approved.status, "completed");
    assert.strictEqual(approved.replayed, false);
    assert.strictEqual(approved.result.messageId, 777);
    assert.strictEqual(approved.result.chatId, "-100123");
    assert.strictEqual(harness.getSendCount(), 1);

    const replay = await coordinator.approve({
        approvalId: prepared.approvalId,
        payloadHash: prepared.payloadHash,
        confirm: true
    });

    assert.strictEqual(replay.status, "completed");
    assert.strictEqual(replay.replayed, true);
    assert.strictEqual(harness.getSendCount(), 1);

    const restarted = new GenericTelegramPublishCoordinator({
        assistant: harness.assistant,
        taskEngine: harness.taskEngine,
        store
    });

    const replayAfterRestart = await restarted.approve({
        approvalId: prepared.approvalId,
        payloadHash: prepared.payloadHash,
        confirm: true
    });

    assert.strictEqual(replayAfterRestart.replayed, true);
    assert.strictEqual(harness.getSendCount(), 1);
}

async function testApprovedPayloadMismatchBlocked() {
    const store = createStore();
    const harness = createHarness();

    const coordinator = new GenericTelegramPublishCoordinator({
        assistant: harness.assistant,
        taskEngine: harness.taskEngine,
        store
    });

    const prepared = await coordinator.prepare({
        content: "Original approved content"
    }, "req-mismatch");

    const savedAction = store.snapshot()[0];
    const task = harness.tasks.get(savedAction.taskId);
    task.input.message = "Changed content";

    await expectCode(
        coordinator.approve({
            approvalId: prepared.approvalId,
            payloadHash: prepared.payloadHash,
            confirm: true
        }),
        "GENERIC_TELEGRAM_APPROVED_PAYLOAD_MISMATCH"
    );

    assert.strictEqual(harness.getSendCount(), 0);
}

async function testProviderConfirmationRequired() {
    const store = createStore();
    const harness = createHarness({
        noMessageId: true
    });

    const coordinator = new GenericTelegramPublishCoordinator({
        assistant: harness.assistant,
        taskEngine: harness.taskEngine,
        store
    });

    const prepared = await coordinator.prepare({
        content: "Provider confirmation test"
    }, "req-provider");

    await expectCode(
        coordinator.approve({
            approvalId: prepared.approvalId,
            payloadHash: prepared.payloadHash,
            confirm: true
        }),
        "GENERIC_TELEGRAM_PROVIDER_CONFIRMATION_REQUIRED"
    );

    const action = store.snapshot()[0];

    assert.strictEqual(action.status, "failed");
    assert.strictEqual(
        action.failureCode,
        "GENERIC_TELEGRAM_PROVIDER_CONFIRMATION_REQUIRED"
    );
}

async function testExecutionFailureIsPersisted() {
    const store = createStore();
    const harness = createHarness({
        throwOnExecution: true
    });

    const coordinator = new GenericTelegramPublishCoordinator({
        assistant: harness.assistant,
        taskEngine: harness.taskEngine,
        store
    });

    const prepared = await coordinator.prepare({
        content: "Execution failure test"
    }, "req-failure");

    await expectCode(
        coordinator.approve({
            approvalId: prepared.approvalId,
            payloadHash: prepared.payloadHash,
            confirm: true
        }),
        "TELEGRAM_SEND_FAILED"
    );

    const action = store.snapshot()[0];

    assert.strictEqual(action.status, "failed");
    assert.strictEqual(
        action.failureCode,
        "TELEGRAM_SEND_FAILED"
    );
}

async function run() {
    await testPrepareApprovalAndReplay();
    await testApprovedPayloadMismatchBlocked();
    await testProviderConfirmationRequired();
    await testExecutionFailureIsPersisted();

    console.log(
        "Generic Telegram Publishing approval, immutability, " +
        "idempotency, persistence, and provider-confirmation tests passed"
    );
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
