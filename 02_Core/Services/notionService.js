class NotionService {
    constructor(options = {}) {
        this.env = options.env || process.env;
        this.fetch = options.fetch || globalThis.fetch;
        this.notionVersion = options.notionVersion || "2022-06-28";
    }

    async getDatabaseRecords(request) {
        const page = await this.queryDatabasePage(request);
        return { records: page.records };
    }

    async queryDatabasePage(request) {
        if (!request || typeof request !== "object" || !request.databaseId) {
            const error = new Error("Notion databaseId is required");
            error.code = "NOTION_DATABASE_ID_REQUIRED";
            throw error;
        }

        const token = this.env.NOTION_API_TOKEN;

        if (!token) {
            const error = new Error("NOTION_API_TOKEN is required");
            error.code = "NOTION_API_TOKEN_REQUIRED";
            throw error;
        }

        if (typeof this.fetch !== "function") {
            throw new Error("A fetch implementation is required");
        }

        if (request.filter !== undefined &&
            (!request.filter || typeof request.filter !== "object" ||
                Array.isArray(request.filter))) {
            const error = new Error("Notion filter must be an object");
            error.code = "NOTION_FILTER_INVALID";
            throw error;
        }

        const response = await this.fetch(
            `https://api.notion.com/v1/databases/${encodeURIComponent(request.databaseId)}/query`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Notion-Version": this.notionVersion,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    ...(request.filter ? { filter: request.filter } : {}),
                    ...(request.startCursor ? { start_cursor: request.startCursor } : {}),
                    ...(request.pageSize ? { page_size: request.pageSize } : {})
                })
            }
        );
        const data = await response.json();

        if (!response.ok) {
            const error = new Error(data.message || "Notion API request failed");
            error.code = "NOTION_API_ERROR";
            throw error;
        }

        return {
            records: Array.isArray(data.results) ? data.results : [],
            hasMore: data.has_more === true,
            nextCursor: data.next_cursor || null
        };
    }

    async getAllDatabaseRecords(request) {
        const records = []; let startCursor = null;
        do {
            const page = await this.queryDatabasePage({ ...request, startCursor, pageSize: 100 });
            records.push(...page.records); startCursor = page.hasMore ? page.nextCursor : null;
        } while (startCursor);
        return { records };
    }

    async createDatabasePage(request) {
        if (!request || !request.databaseId || !request.properties) { const error = new Error("Notion page request is invalid"); error.code = "NOTION_PAGE_REQUEST_INVALID"; throw error; }
        const token = this.env.NOTION_API_TOKEN;
        if (!token) { const error = new Error("NOTION_API_TOKEN is required"); error.code = "NOTION_API_TOKEN_REQUIRED"; throw error; }
        const response = await this.fetch("https://api.notion.com/v1/pages", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Notion-Version": this.notionVersion, "Content-Type": "application/json" }, body: JSON.stringify({ parent: { database_id: request.databaseId }, properties: request.properties }) });
        const data = await response.json();
        if (!response.ok) { const error = new Error(data.message || "Notion API request failed"); error.code = "NOTION_API_ERROR"; throw error; }
        return data;
    }
}

module.exports = NotionService;
