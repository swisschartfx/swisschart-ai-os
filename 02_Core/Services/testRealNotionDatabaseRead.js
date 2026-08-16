const NotionService = require("./notionService");

async function run() {
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!process.env.NOTION_API_TOKEN) {
        throw new Error("NOTION_API_TOKEN is required");
    }

    if (!databaseId) {
        throw new Error("NOTION_DATABASE_ID is required");
    }

    const service = new NotionService();
    const { records } = await service.getDatabaseRecords({ databaseId });
    const firstRecordProperties = records[0]?.properties || {};
    const propertyNames = [
        ...new Set(
            records.flatMap(record => Object.keys(record.properties || {}))
        )
    ].sort();

    console.log("Number of records:", records.length);
    console.log("First record properties:");
    console.dir(firstRecordProperties, { depth: null });
    console.log("Available property names:", propertyNames);
}

run().catch(error => {
    console.error("Real Notion database read failed:", error.message);
    process.exitCode = 1;
});
