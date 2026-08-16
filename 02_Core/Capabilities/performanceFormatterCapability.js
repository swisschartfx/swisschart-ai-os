class PerformanceFormatterCapability {
    constructor() {
        this.name = "performance_formatter";
    }

    async execute(input) {
        const summary = input && input.summary &&
            typeof input.summary === "object"
            ? input.summary
            : {};
        const winRate = numberOrZero(summary.winRate) <= 1
            ? numberOrZero(summary.winRate) * 100
            : numberOrZero(summary.winRate);

        return {
            type: "formatted_message",
            content: [
                "Swisschart Performance Summary",
                `Total trades: ${numberOrZero(summary.totalTrades)}`,
                `Completed trades: ${numberOrZero(summary.completedTrades)}`,
                `Wins: ${numberOrZero(summary.wins)}`,
                `Losses: ${numberOrZero(summary.losses)}`,
                `Break-even: ${numberOrZero(summary.breakeven)}`,
                `Win rate: ${winRate.toFixed(1)}%`,
                `Total R: ${formatNumber(summary.totalRR)}`,
                `Average R: ${formatNumber(summary.averageRR)}`
            ].join("\n")
        };
    }
}

function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
    return Number(numberOrZero(value).toFixed(2)).toString();
}

module.exports = PerformanceFormatterCapability;
