const notion = require("../01_Journal_Agent/services/notion");

class RealNotionDataSource {
    constructor(options = {}) {
        this.notion = options.notion || notion;
        this.dataSourceId = options.dataSourceId ||
            process.env.NOTION_DATA_SOURCE_ID;

        if (!this.dataSourceId) {
            throw new Error("NOTION_DATA_SOURCE_ID is missing");
        }
    }

    async query(filters = {}) {
        const pages = [];
        let startCursor;

        do {
            const response = await this.notion.dataSources.query({
                data_source_id: this.dataSourceId,
                ...(startCursor ? { start_cursor: startCursor } : {})
            });

            pages.push(...response.results);
            startCursor = response.has_more
                ? response.next_cursor
                : null;
        } while (startCursor);

        return pages
            .map(normalizeTrade)
            .filter(trade => matchesFilters(trade, filters));
    }
}

function normalizeTrade(page) {
    const properties = page.properties || {};

    return {
        notionPageId: page.id,
        tradeId: readText(properties["Trade ID"]),
        pair: readSelect(properties.Pair),
        direction: readSelect(properties.Direction),
        grade: readSelect(properties.Grade),
        result: readSelect(properties.Result),
        status: readSelect(properties.Status),
        tradeState: readSelect(properties["Trade State"]),
        finalRR: readNumber(properties["Final RR"]),
        cumulativeRR: readNumber(properties["Cumulative RR"]),
        riskPercent: readNumber(properties["Risk %"]),
        publishDate: readDate(properties["Publish Date"])
    };
}

function readText(property) {
    const item = property && (property.title || property.rich_text);
    return item && item[0]
        ? item[0].plain_text || item[0].text && item[0].text.content || null
        : null;
}

function readSelect(property) {
    return property && property.select
        ? property.select.name
        : null;
}

function readNumber(property) {
    return property && Number.isFinite(property.number)
        ? property.number
        : null;
}

function readDate(property) {
    return property && property.date
        ? property.date.start
        : null;
}

function matchesFilters(trade, filters) {
    return Object.entries(filters).every(([field, value]) =>
        value === undefined || trade[field] === value
    );
}

module.exports = RealNotionDataSource;
module.exports.normalizeTrade = normalizeTrade;
