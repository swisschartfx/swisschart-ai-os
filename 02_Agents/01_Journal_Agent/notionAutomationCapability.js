function createDefaultJournalAgent() {
    const JournalAgent = require("./agents/journalAgent");
    return new JournalAgent();
}

class NotionAutomationCapability {
    constructor(options = {}) {
        this.journalAgent = options.journalAgent || createDefaultJournalAgent();

        if (!this.journalAgent ||
            typeof this.journalAgent.readTrades !== "function") {
            throw new Error("Notion Automation Capability requires Journal Agent");
        }
    }

    async execute(input) {
        if (!input || typeof input !== "object") {
            throw new Error("Notion automation input is required");
        }

        const trades = (await this.journalAgent.readTrades()).map(normalizeTrade);
        const filteredTrades = applyFilters(trades, input.filters || {});

        if (input.intent === "get_trade_history") {
            return {
                type: "notion_result",
                data: {
                    type: "trade_history",
                    count: filteredTrades.length,
                    trades: filteredTrades
                }
            };
        }

        if (input.intent === "get_performance_summary") {
            return {
                type: "notion_result",
                data: createPerformanceSummary(filteredTrades)
            };
        }

        throw new Error(`Unsupported Notion automation intent: ${input.intent}`);
    }
}

function normalizeTrade(trade) {
    if (!trade.properties) {
        return { ...trade };
    }

    return {
        notionPageId: trade.id,
        tradeId: readText(trade.properties["Trade ID"]),
        pair: readSelect(trade.properties.Pair),
        result: readSelect(trade.properties.Result),
        finalRR: readNumber(trade.properties["Final RR"])
    };
}

function createPerformanceSummary(trades) {
    const completed = trades.filter(trade =>
        ["win", "loss", "breakeven"].includes(normalizeResult(trade.result))
    );
    const wins = completed.filter(trade =>
        normalizeResult(trade.result) === "win"
    ).length;
    const totalRR = completed.reduce((total, trade) =>
        total + (Number.isFinite(Number(trade.finalRR))
            ? Number(trade.finalRR)
            : 0), 0);

    return {
        type: "performance_summary",
        totalTrades: trades.length,
        completedTrades: completed.length,
        wins,
        losses: completed.filter(trade =>
            normalizeResult(trade.result) === "loss"
        ).length,
        breakeven: completed.filter(trade =>
            normalizeResult(trade.result) === "breakeven"
        ).length,
        winRate: completed.length > 0 ? wins / completed.length : 0,
        totalRR
    };
}

function applyFilters(trades, filters) {
    return trades.filter(trade => Object.entries(filters)
        .every(([field, value]) => value === undefined || trade[field] === value));
}

function readText(property) {
    const values = property && (property.title || property.rich_text);
    return values && values[0] ? values[0].plain_text || null : null;
}

function readSelect(property) {
    return property && property.select ? property.select.name : null;
}

function readNumber(property) {
    return property && Number.isFinite(property.number) ? property.number : null;
}

function normalizeResult(result) {
    return String(result || "").trim().toLowerCase();
}

module.exports = NotionAutomationCapability;
