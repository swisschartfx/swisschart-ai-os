const assert = require("assert");
const path = require("path");

const dotenv = require(
    "../../02_Agents/02_Publishing_Agent/node_modules/dotenv"
);

dotenv.config({
    path: path.join(
        __dirname,
        "../../02_Agents/02_Publishing_Agent/.env"
    ),
    override: true,
    quiet: true
});

const TelegramService = require(
    "../../02_Agents/02_Publishing_Agent/services/telegram"
);

async function run() {
    const missing = [
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID"
    ].filter(name => !process.env[name]);

    if (missing.length > 0) {
        throw new Error(`Missing configuration: ${missing.join(", ")}`);
    }

    const service = new TelegramService();
    const response = await service.sendMessage(
        "Swisschart AI OS Telegram connection test"
    );

    assert.ok(response, "Telegram API response is required");
    assert.ok(response.message_id, "Telegram message_id is required");
    assert.ok(response.chat && response.chat.id,
        "Telegram response chat id is required");

    console.log(`PASS message_id=${response.message_id}`);
    console.log("Existing Swisschart Telegram publishing path works");
}

run().catch(error => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
});
