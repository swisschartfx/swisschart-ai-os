const { validateNormalizedPeriod, isUnboundedPeriod } = require("../Time/periodContract");

class NotionCapability {
    constructor(options = {}) {
        this.name = "notion";
        this.clock = options.clock || (() => new Date());
        this.notionService = options.notionService === undefined
            ? createNotionService()
            : options.notionService;

        if (!this.notionService ||
            typeof this.notionService.getDatabaseRecords !== "function") {
            const error = new Error("Notion Capability requires Notion Service");
            error.code = "NOTION_CAPABILITY_SERVICE_REQUIRED";
            throw error;
        }
    }

    async execute(request) {
        if (!request || typeof request !== "object") {
            throw new Error("Notion capability request is required");
        }

        if (!["get_performance_summary", "get_normalized_trades"].includes(request.intent)) {
            const error = new Error(
                `Unsupported Notion capability intent: ${request.intent}`
            );
            error.code = "NOTION_CAPABILITY_INTENT_UNSUPPORTED";
            throw error;
        }

        if (request.source !== "trading_journal") {
            const error = new Error("Notion capability source must be trading_journal");
            error.code = "NOTION_CAPABILITY_SOURCE_INVALID";
            throw error;
        }

        if (request.period !== undefined) validateNormalizedPeriod(request.period);

        if (request.filters !== undefined &&
            (!request.filters || request.filters.status !== "closed" ||
                Object.keys(request.filters).length !== 1)) {
            const error = new Error("Unsupported Notion capability filters");
            error.code = "NOTION_CAPABILITY_FILTER_UNSUPPORTED";
            throw error;
        }

        const databaseId = request.databaseId ||
            (request.source === "trading_journal"
                ? process.env.NOTION_DATABASE_ID
                : null);

        if (!databaseId) {
            const error = new Error(
                "NOTION_DATABASE_ID is required for source trading_journal"
            );
            error.code = "NOTION_DATABASE_ID_REQUIRED";
            throw error;
        }

        const serviceRequest = { databaseId };
        const filters = [];
        if (request.period) {
            filters.push(...periodFilter(request.period).and);
        }
        if (request.filters && request.filters.status === "closed") {
            filters.push(closedTradesFilter());
        }
        if (filters.length) serviceRequest.filter = { and: filters };

        const response = await this.notionService.getDatabaseRecords(serviceRequest);
        const records = response && Array.isArray(response.records)
            ? response.records
            : [];
        if (request.intent === "get_normalized_trades") {
            return {
                records: records.map((record) => ({
                    result: readResult(record),
                    realizedRR: readRealizedRR(record),
                    tradeDate: readTradeDate(record)
                }))
            };
        }
        const classified = records.map(record => ({
            result: readResult(record),
            rr: readRR(record)
        }));
        const closed = classified.filter(record =>
            ["win", "loss", "break_even"].includes(record.result)
        );
        const wins = countResult(classified, "win");
        const losses = countResult(classified, "loss");
        const breakEven = countResult(classified, "break_even");
        const cancelled = countResult(classified, "cancelled");
        const pending = countResult(classified, "pending");
        const decisiveTrades = wins + losses;
        const netRR = closed.reduce((total, record) => total + record.rr, 0);

        return {
            totalTrades: records.length,
            closedTrades: closed.length,
            wins,
            losses,
            breakEven,
            cancelled,
            pending,
            winRate: decisiveTrades > 0 ? wins / decisiveTrades : 0,
            averageRR: closed.length > 0 ? netRR / closed.length : 0,
            netRR
        };
    }
}

function periodFilter(period) {
    if (isUnboundedPeriod(period)) return { and: [] };
    return {
        and: [{
            property: "Publish Date",
            date: { on_or_after: period.startLocalDate }
        }, {
            property: "Publish Date",
            date: { before: period.endLocalDateExclusive }
        }]
    };
}

function closedTradesFilter() {
    return {
        or: ["Win", "Loss", "BE"].map((name) => ({
            property: "Result",
            select: { equals: name }
        }))
    };
}

function createNotionService() {
    const NotionService = require("../Services/notionService");
    return new NotionService();
}

function normalizeResult(result) {
    const normalized = String(result || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    if (!normalized) {
        return "pending";
    }

    if (["be", "break even", "breakeven"].includes(normalized)) {
        return "break_even";
    }

    if (["canceled", "cancelled", "cancelld", "missed"].includes(normalized)) {
        return "cancelled";
    }

    return normalized;
}

function countResult(records, result) {
    return records.filter(record => record.result === result).length;
}

function readResult(record) {
    const notionResult = record && record.properties &&
        record.properties.Result;
    const value = notionResult && notionResult.select
        ? notionResult.select.name
        : record && record.result;

    return normalizeResult(value);
}

function readRR(record) {
    const properties = record && record.properties;

    if (properties) {
        const finalRR = readNotionNumber(properties["Final RR"]);
        if (finalRR !== null) {
            return finalRR;
        }

        const netRR = readNotionNumber(properties["Net RR"]);
        return netRR === null ? 0 : netRR;
    }

    const finalRR = Number(record && record.finalRR);
    if (Number.isFinite(finalRR)) {
        return finalRR;
    }

    const netRR = Number(record && record.netRR);
    return Number.isFinite(netRR) ? netRR : 0;
}

function readRealizedRR(record) {
    const properties = record && record.properties;
    if (properties) {
        const finalRR = readNotionNumber(properties["Final RR"]);
        if (finalRR !== null) return finalRR;
        return readNotionNumber(properties["Net RR"]);
    }
    const finalRR = Number(record && record.finalRR);
    if (Number.isFinite(finalRR)) return finalRR;
    const netRR = Number(record && record.netRR);
    return Number.isFinite(netRR) ? netRR : null;
}

function readTradeDate(record) {
    const property = record && record.properties && record.properties["Publish Date"];
    if (property && property.date && typeof property.date.start === "string") {
        return property.date.start;
    }
    return record && typeof record.tradeDate === "string" ? record.tradeDate : null;
}

function readNotionNumber(property) {
    if (!property || typeof property !== "object") {
        return null;
    }

    const value = property.type === "formula"
        ? property.formula && property.formula.number
        : property.number;

    return Number.isFinite(value) ? value : null;
}

module.exports = NotionCapability;
