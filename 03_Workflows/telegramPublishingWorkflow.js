class TelegramPublishingWorkflow {
    constructor(options = {}) {
        const adapter = options.telegramBotAdapter || options.telegramService;

        if (!adapter || typeof adapter.sendMessage !== "function") {
            throw new Error("Telegram Publishing Workflow requires a Telegram adapter");
        }

        this.telegramService = adapter;
    }

    async execute(task) {
        if (!task || typeof task !== "object") {
            throw new Error("An approved publishing Task is required");
        }

        if (!task.approval || task.approval.status !== "approved") {
            const error = new Error("Telegram publishing requires explicit approval");
            error.code = "TELEGRAM_PUBLISHING_APPROVAL_REQUIRED";
            throw error;
        }

        const input = task.input || {};
        const payload = {
            chatId: input.chatId || input.destination,
            text: input.message,
            parseMode: input.parseMode || "HTML",
            disableWebPagePreview: input.disableWebPagePreview !== false
        };

        return this.telegramService.sendMessage(payload);
    }
}

module.exports = TelegramPublishingWorkflow;
