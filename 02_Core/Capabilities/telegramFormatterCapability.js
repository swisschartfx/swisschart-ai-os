class TelegramFormatterCapability {
    constructor() {
        this.name = "telegram_formatter";
    }

    async execute(request) {
        if (!request || typeof request !== "object") {
            throw new Error("Telegram formatter request is required");
        }

        if (request.intent !== "format_performance_report") {
            const error = new Error(
                `Unsupported Telegram formatter intent: ${request.intent}`
            );
            error.code = "TELEGRAM_FORMATTER_INTENT_UNSUPPORTED";
            throw error;
        }

        const summary = validateSummary(request);
        const winRate = summary.winRate <= 1
            ? summary.winRate * 100
            : summary.winRate;

        return {
            message: [
                "<b>Swisschart Performance</b>",
                `Total trades: ${summary.totalTrades}`,
                `Closed trades: ${summary.closedTrades}`,
                `Wins: ${summary.wins} | Losses: ${summary.losses} | Break-even: ${summary.breakEven}`,
                `Cancelled: ${summary.cancelled} | Pending: ${summary.pending}`,
                `Win rate: ${winRate.toFixed(1)}%`,
                `Average R: ${formatNumber(summary.averageRR)}`,
                `Net R: ${formatNumber(summary.netRR)}`
            ].join("\n"),
            type: "telegram_message"
        };
    }
}

function validateSummary(request) {
    const summary = {};

    for (const field of [
        "totalTrades",
        "closedTrades",
        "wins",
        "losses",
        "breakEven",
        "cancelled",
        "pending",
        "winRate",
        "averageRR",
        "netRR"
    ]) {
        const value = Number(request[field]);
        summary[field] = Number.isFinite(value) ? value : 0;
    }

    return summary;
}

function formatNumber(value) {
    return Number(value.toFixed(2)).toString();
}

module.exports = TelegramFormatterCapability;
