class TelegramAssistantAdapter {
    constructor(options = {}) {
        this.assistant = options.assistant;
        this.transport = options.transport;
        this.founderUserId = normalizeId(options.founderUserId ||
            process.env.TELEGRAM_FOUNDER_USER_ID);

        if (!this.assistant || typeof this.assistant.handle !== "function") {
            throw new Error("Telegram Assistant Adapter requires SwisschartAssistant");
        }
        if (!this.transport || typeof this.transport.sendMessage !== "function") {
            throw new Error("Telegram Assistant Adapter requires a Telegram transport");
        }
        if (!this.founderUserId) {
            throw new Error("TELEGRAM_FOUNDER_USER_ID is required");
        }
    }

    async handleUpdate(update) {
        const message = update && update.message;
        if (!isPrivateMessage(message)) return { status: "ignored" };

        const senderId = normalizeId(message.from && message.from.id);
        const chatId = normalizeId(message.chat && message.chat.id);
        if (senderId !== this.founderUserId || chatId !== this.founderUserId) {
            return { status: "unauthorized" };
        }
        if (typeof message.text !== "string" || !message.text.trim()) {
            return { status: "ignored" };
        }

        try {
            const response = await this.assistant.handle(message.text);
            const reply = response && typeof response.message === "string" &&
                response.message.trim()
                ? response.message
                : "The Assistant could not produce a response.";
            await this.transport.sendMessage({
                chatId: message.chat.id,
                text: safeTelegramText(reply)
            });
            return { status: "replied" };
        } catch (error) {
            await this.transport.sendMessage({
                chatId: message.chat.id,
                text: "The Assistant is temporarily unavailable. Please try again later."
            });
            return { status: "failed" };
        }
    }
}

const MAX_TELEGRAM_ASSISTANT_TEXT_LENGTH = 4000;
const TRUNCATION_NOTICE = "\n\n[Response shortened for Telegram.]";

function safeTelegramText(text) {
    if (text.length <= MAX_TELEGRAM_ASSISTANT_TEXT_LENGTH) return text;
    return text.slice(0, MAX_TELEGRAM_ASSISTANT_TEXT_LENGTH -
        TRUNCATION_NOTICE.length) + TRUNCATION_NOTICE;
}

function isPrivateMessage(message) {
    return Boolean(message && message.chat && message.chat.type === "private" &&
        message.from);
}

function normalizeId(value) {
    if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return value.trim();
    return null;
}

module.exports = TelegramAssistantAdapter;
module.exports.MAX_TELEGRAM_ASSISTANT_TEXT_LENGTH =
    MAX_TELEGRAM_ASSISTANT_TEXT_LENGTH;
