const { requireManualExternalAuthorization } = require("./manualExternalGuard");

requireManualExternalAuthorization({
    description: "send a Telegram photo probe",
    actionFlags: ["SWISSCHART_CONFIRM_TELEGRAM_SEND"]
});

const TelegramService = require(
    "../../02_Agents/02_Publishing_Agent/services/telegram"
);

async function main() {
    const photoPath = process.env.SWISSCHART_MANUAL_PHOTO_PATH;
    if (!photoPath) {
        const error = new Error("SWISSCHART_MANUAL_PHOTO_PATH is required");
        error.code = "MANUAL_PHOTO_PATH_REQUIRED";
        throw error;
    }

    const telegram = new TelegramService();
    const result = await telegram.sendPhoto(
        photoPath,
        "Swisschart manual Telegram photo probe"
    );
    console.log(`MANUAL EXTERNAL ACTION COMPLETED message_id=${result.message_id}`);
}

main().catch(error => {
    console.error(`MANUAL EXTERNAL ACTION FAILED: ${error.message}`);
    process.exitCode = 1;
});
