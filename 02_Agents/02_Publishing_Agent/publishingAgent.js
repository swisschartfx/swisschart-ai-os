try { require("dotenv").config({ path: __dirname + "/.env" }); } catch (error) {}

const TelegramService = require("./services/telegram");
const formatTelegramSignal = require("./utils/telegramFormatter");

const SWISSCHART_LINK = "https://linktr.ee/swisschart";
const SWISSCHART_FOOTER =
    `<a href="${SWISSCHART_LINK}">Swisschart Links</a>`;

function ensureSwisschartFooter(message) {
    const content = String(message || "");

    if (content.includes(SWISSCHART_LINK)) {
        return content;
    }

    return `${content.trimEnd()}\n\n${SWISSCHART_FOOTER}`;
}

class PublishingAgent {

    constructor(options = {}) {
        this.telegram = options.telegram || new TelegramService();

        console.log("📡 Publishing Agent initialized");
    }

    async publishSignal(signal) {

        console.log("================================");
        console.log(`📤 Publishing ${signal.tradeId}`);
        console.log("================================");

        const message = ensureSwisschartFooter(
            formatTelegramSignal(signal)
        );

        if (signal.signalScreenshot) {

            console.log("📸 Signal screenshot detected");

            const result =
                await this.telegram.sendPhoto(
                    signal.signalScreenshot,
                    message
                );

            console.log(
                `✅ ${signal.tradeId} published with screenshot`
            );

            return result;
        }

        const result =
            await this.telegram.sendMessage(
                message
            );

        console.log(
            `✅ ${signal.tradeId} published as text`
        );

        return result;
    }

    async publishContent(message) {

        if (!message) {
            throw new Error(
                "Content message is empty"
            );
        }

        console.log(
            "📤 Publishing Telegram Content"
        );

        const result =
            await this.telegram.sendMessage(
                ensureSwisschartFooter(message)
            );

        console.log(
            "✅ Telegram content published"
        );

        return result;
    }
}

module.exports = PublishingAgent;
