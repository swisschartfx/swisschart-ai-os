class PerformanceSummaryTelegramWorkflow {
    constructor(options = {}) {
        if (!options.notionCapability ||
            typeof options.notionCapability.execute !== "function") {
            throw new Error(
                "Performance Summary Telegram Workflow requires Notion Capability"
            );
        }

        if (!options.telegramFormatterCapability ||
            typeof options.telegramFormatterCapability.execute !== "function") {
            throw new Error(
                "Performance Summary Telegram Workflow requires Telegram Formatter Capability"
            );
        }

        if (!options.taskEngine || typeof options.taskEngine.execute !== "function") {
            throw new Error(
                "Performance Summary Telegram Workflow requires Task Engine"
            );
        }

        this.notionCapability = options.notionCapability;
        this.telegramFormatterCapability = options.telegramFormatterCapability;
        this.taskEngine = options.taskEngine;
    }

    async execute(request = {}) {
        if (!request.source) {
            throw new Error("Performance Summary workflow source is required");
        }

        if (!request.sourceReference) {
            throw new Error(
                "Performance Summary workflow sourceReference is required"
            );
        }

        const summary = await this.notionCapability.execute({
            intent: "get_performance_summary",
            source: "trading_journal"
        });
        const formatted = await this.telegramFormatterCapability.execute({
            intent: "format_performance_report",
            ...summary
        });

        validateFormattedMessage(formatted);

        return this.taskEngine.execute({
            source: request.source,
            sourceReference: request.sourceReference,
            createdBy: "performance-summary-telegram-workflow",
            intent: "content.publish",
            objective: "Publish the formatted Performance Summary after Founder approval.",
            capabilityRequirement: "publishing.publish",
            input: {
                message: formatted.message,
                destination: "telegram.primary",
                contentType: "text"
            },
            priority: "normal",
            approval: {
                required: true,
                status: "pending"
            }
        });
    }
}

function validateFormattedMessage(formatted) {
    if (!formatted ||
        formatted.type !== "telegram_message" ||
        typeof formatted.message !== "string" ||
        !formatted.message.trim()) {
        const error = new Error(
            "Telegram Formatter must return a valid telegram_message"
        );
        error.code = "PERFORMANCE_SUMMARY_TELEGRAM_MESSAGE_INVALID";
        throw error;
    }
}

module.exports = PerformanceSummaryTelegramWorkflow;
