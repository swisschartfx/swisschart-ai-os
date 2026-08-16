const assert = require("assert");
const path = require("path");
const dotenv = require("../../02_Agents/01_Journal_Agent/node_modules/dotenv");

const CapabilityRegistry = require("./capabilityRegistry");
const CapabilityGateway = require("./capabilityGateway");
const TelegramPublishingCapability = require("./telegramPublishingCapability");
const { createCapabilityRequest } = require("./capabilityContract");

dotenv.config({ path: path.join(__dirname, "../../.env"), override: true, quiet: true });

async function run() {
    if (process.env.CONFIRM_REAL_TELEGRAM_PUBLISH !== "YES") {
        throw new Error("Set CONFIRM_REAL_TELEGRAM_PUBLISH=YES to authorize the real publish proof");
    }

    const capability = new TelegramPublishingCapability();
    const gateway = new CapabilityGateway({
        registry: new CapabilityRegistry([capability])
    });
    const pending = await gateway.execute(createCapabilityRequest({
        capability: "publishing.telegram",
        operation: "publishing.telegram.publish",
        input: { message: "Swisschart Capability Gateway real publishing proof" },
        context: {},
        constraints: {},
        metadata: {},
        requestedBy: "founder",
        source: "real-telegram-proof",
        inputContractVersion: "1.0"
    }));

    assert.strictEqual(pending.status, "blocked");
    assert.strictEqual(pending.data.approvalStatus, "pending");

    capability.taskEngine.founderApprovalController.approve(pending.data.taskId);
    const completed = await capability.taskEngine.resumeApprovedTask(pending.data.taskId);

    assert.strictEqual(completed.task.status, "completed");
    assert.ok(completed.result.externalReferences[0].messageId);
    console.log(completed.result);
    console.log("Real Telegram Publishing Capability proof passed");
}

run().catch((error) => {
    console.error("Real Telegram Publishing Capability proof failed:", error.message);
    process.exitCode = 1;
});
