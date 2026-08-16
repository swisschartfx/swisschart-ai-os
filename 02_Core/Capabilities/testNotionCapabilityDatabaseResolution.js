const assert = require("assert");

const NotionCapability = require("./notionCapability");

async function run() {
    const originalDatabaseId = process.env.NOTION_DATABASE_ID;
    const serviceCalls = [];

    process.env.NOTION_DATABASE_ID = "configured-trading-journal-database";

    try {
        const capability = new NotionCapability({
            notionService: {
                async getDatabaseRecords(request) {
                    serviceCalls.push(request);
                    return { records: [] };
                }
            }
        });

        await capability.execute({
            intent: "get_performance_summary",
            source: "trading_journal"
        });

        assert.deepStrictEqual(serviceCalls, [{
            databaseId: "configured-trading-journal-database"
        }]);

        console.log("Notion Capability database resolution test passed");
    } finally {
        if (originalDatabaseId === undefined) {
            delete process.env.NOTION_DATABASE_ID;
        } else {
            process.env.NOTION_DATABASE_ID = originalDatabaseId;
        }
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
