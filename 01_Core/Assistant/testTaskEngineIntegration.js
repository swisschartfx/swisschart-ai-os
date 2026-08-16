const assert = require("assert");

const SwisschartAssistant =
    require("./01_assistant");

const TaskEngine =
    require("../Task_Engine/02_taskEngine");

function createMockExecutor(options = {}) {
    const calls = [];

    return {
        calls,
        async execute(instruction) {
            calls.push(instruction);

            if (options.error) {
                throw options.error;
            }

            return {
                output: {
                    publicationType: "text",
                    destination: instruction.destination,
                    messageLength: instruction.message.length
                },
                externalReferences: [{
                    platform: "telegram",
                    messageId: 98765
                }],
                evidence: [{
                    type: "mock_telegram_response"
                }]
            };
        }
    };
}

function createAssistant(executor) {
    return new SwisschartAssistant({
        testMode: true,
        taskEngine: new TaskEngine({
            executors: {
                "publishing-agent": executor
            }
        })
    });
}

async function run() {
    const executor = createMockExecutor();
    const assistant = createAssistant(executor);

    const pending = await assistant.handle(
        "publish telegram: Pending approval message"
    );
    assert.strictEqual(pending.taskStatus, "awaiting_approval");
    assert.strictEqual(pending.completed, false);
    assert.strictEqual(executor.calls.length, 0);

    const completed = await assistant.handle(
        "publish telegram: Approved publication message",
        {
            founderApprovalVerified: true,
            founderId: "founder",
            sourceReference: "founder-request-approved"
        }
    );
    assert.strictEqual(completed.taskStatus, "completed");
    assert.strictEqual(completed.completed, true);
    assert.match(completed.message, /Message ID: 98765/);
    assert.strictEqual(executor.calls.length, 1);
    assert.strictEqual(
        executor.calls[0].message,
        "Approved publication message"
    );

    const invalid = await assistant.handle(
        "publish telegram:",
        {
            founderApprovalVerified: true,
            sourceReference: "founder-request-invalid"
        }
    );
    assert.strictEqual(invalid.taskStatus, "validation_failed");
    assert.strictEqual(executor.calls.length, 1);

    const blockedAssistant = new SwisschartAssistant({
        testMode: true,
        taskEngine: new TaskEngine({
            executors: {}
        })
    });
    const blocked = await blockedAssistant.handle(
        "publish telegram: Blocked publication message",
        {
            founderApprovalVerified: true,
            sourceReference: "founder-request-blocked"
        }
    );
    assert.strictEqual(blocked.taskStatus, "blocked");

    const deliveryError = new Error(
        "Telegram delivery was not verified"
    );
    deliveryError.code =
        "TELEGRAM_DELIVERY_UNVERIFIED";
    const failingAssistant = createAssistant(
        createMockExecutor({ error: deliveryError })
    );
    const failed = await failingAssistant.handle(
        "publish telegram: Failed publication message",
        {
            founderApprovalVerified: true,
            sourceReference: "founder-request-failed"
        }
    );
    assert.strictEqual(failed.taskStatus, "failed");
    assert.strictEqual(failed.success, false);

    const signalAssistant = createAssistant(createMockExecutor());
    const signal = await signalAssistant.handle("signal");
    assert.strictEqual(signal.workflow, "signal");
    assert.strictEqual(signal.completed, false);

    console.log("Assistant Task Engine mock integration tests passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
