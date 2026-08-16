class MockNotionDatabase {
    constructor(trades = []) {
        this.trades = [...trades];
    }

    async query(filters = {}) {
        return this.trades.filter(trade =>
            Object.entries(filters).every(([field, value]) =>
                value === undefined || trade[field] === value
            )
        );
    }
}

class NotionAgent {
    constructor(options = {}) {
        this.dataSource = options.dataSource || createDataSource(options);

        if (typeof this.dataSource.query !== "function") {
            throw new Error("Notion Agent requires a queryable data source");
        }
    }

    async query(filters = {}) {
        const records = await this.dataSource.query(filters);

        if (!Array.isArray(records)) {
            throw new Error("Notion data source query must return an array");
        }

        return records;
    }

    async getTradeHistory(request = {}) {
        const filters = getFilters(request);
        const trades = await this.query(filters);

        return {
            type: "trade_history",
            status: trades.length > 0 ? "success" : "empty",
            count: trades.length,
            trades
        };
    }

    async getPerformanceSummary(request = {}) {
        const filters = getFilters(request);
        const trades = await this.query(filters);
        const completedTrades = trades.filter(trade =>
            ["win", "loss", "breakeven"].includes(normalizeResult(trade.result))
        );
        const wins = completedTrades.filter(trade =>
            normalizeResult(trade.result) === "win"
        ).length;
        const losses = completedTrades.filter(trade =>
            normalizeResult(trade.result) === "loss"
        ).length;
        const breakeven = completedTrades.filter(trade =>
            normalizeResult(trade.result) === "breakeven"
        ).length;
        const totalRR = completedTrades.reduce((total, trade) =>
            total + (Number.isFinite(Number(trade.finalRR))
                ? Number(trade.finalRR)
                : 0), 0
        );

        return {
            type: "performance_summary",
            status: trades.length > 0 ? "success" : "empty",
            summary: {
                totalTrades: trades.length,
                completedTrades: completedTrades.length,
                wins,
                losses,
                breakeven,
                winRate: completedTrades.length > 0
                    ? wins / completedTrades.length
                    : 0,
                totalRR,
                averageRR: completedTrades.length > 0
                    ? totalRR / completedTrades.length
                    : 0
            }
        };
    }

    async handleRequest(request) {
        if (!request || typeof request !== "object") {
            throw new Error("Notion Agent request is required");
        }

        if (request.action === "getTradeHistory") {
            return this.getTradeHistory(request);
        }

        if (request.action === "getPerformanceSummary") {
            return this.getPerformanceSummary(request);
        }

        if (request.action === "query") {
            const records = await this.query(request.filters || {});
            return {
                type: "query_result",
                status: records.length > 0 ? "success" : "empty",
                count: records.length,
                records
            };
        }

        throw new Error(`Unsupported Notion Agent action: ${request.action}`);
    }
}

function createDataSource(options) {
    if (options.mode === "real") {
        const RealNotionDataSource = require("./realNotionDataSource");
        return new RealNotionDataSource(options.realDataSourceOptions);
    }

    return new MockNotionDatabase(options.mockTrades || []);
}

function normalizeResult(result) {
    return String(result || "").trim().toLowerCase();
}

function getFilters(request) {
    if (request.filters) {
        return request.filters;
    }

    const { action, ...filters } = request;
    return filters;
}

module.exports = NotionAgent;
module.exports.MockNotionDatabase = MockNotionDatabase;
