const { requireManualExternalAuthorization } = require("./manualExternalGuard");

requireManualExternalAuthorization({
    description: "send a Telegram connection-probe message",
    actionFlags: ["SWISSCHART_CONFIRM_TELEGRAM_SEND"]
});

const assert = require("assert");
const TelegramService = require(
    "../../02_Agents/02_Publishing_Agent/services/telegram"
);

async function run() {
    const service = new TelegramService();
    const response = await service.sendMessage(
        "Swisschart AI OS Telegram connection test"
    );
    assert.ok(response && response.message_id, "Telegram message_id is required");
    console.log(`MANUAL EXTERNAL ACTION COMPLETED message_id=${response.message_id}`);
}

run().catch(error => {
    console.error(`MANUAL EXTERNAL ACTION FAILED: ${error.message}`);
    process.exitCode = 1;
});
