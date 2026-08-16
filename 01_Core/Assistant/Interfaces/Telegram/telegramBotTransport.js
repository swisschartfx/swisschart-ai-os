class TelegramBotTransport {
    constructor(options = {}) {
        this.botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN;
        this.fetch = options.fetch || globalThis.fetch;
        this.baseUrl = options.baseUrl || "https://api.telegram.org";
        if (!this.botToken) throw new Error("TELEGRAM_BOT_TOKEN is required");
        if (typeof this.fetch !== "function") {
            throw new Error("Telegram Bot transport requires fetch");
        }
    }

    async getUpdates({ offset, timeoutSeconds = 25 } = {}) {
        const result = await this.request("getUpdates", {
            offset,
            timeout: timeoutSeconds,
            allowed_updates: ["message"]
        });
        if (!Array.isArray(result)) {
            throw new Error("Telegram getUpdates returned an invalid result");
        }
        return result;
    }

    async sendMessage({ chatId, text }) {
        if ((typeof chatId !== "string" && typeof chatId !== "number") ||
            typeof text !== "string" || !text.trim()) {
            throw new Error("Telegram reply requires chatId and text");
        }
        return this.request("sendMessage", {
            chat_id: chatId,
            text
        });
    }

    async request(method, body) {
        const response = await this.fetch(
            `${this.baseUrl}/bot${this.botToken}/${method}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            }
        );
        const data = await response.json();
        if (!response.ok || !data || data.ok !== true) {
            const error = new Error(`Telegram ${method} request failed`);
            error.code = "TELEGRAM_BOT_API_ERROR";
            throw error;
        }
        return data.result;
    }
}

module.exports = TelegramBotTransport;
