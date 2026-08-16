const assert = require("assert");

const NotionCapability = require("./notionCapability");

async function run() {
    const serviceCalls = [];
    const notionService = {
        async getDatabaseRecords(request) {
            serviceCalls.push(request);
            return {
                records: [
                    { result: "Win", finalRR: 2 },
                    { result: "Loss", finalRR: -1 },
                    { result: "Pending", finalRR: null }
                ]
            };
        }
    };
    const capability = new NotionCapability({ notionService });
    const result = await capability.execute({
        intent: "get_performance_summary",
        source: "trading_journal",
        databaseId: "journal-database"
    });

    assert.deepStrictEqual(serviceCalls, [{
        databaseId: "journal-database"
    }]);
    assert.deepStrictEqual(result, {
        trades: 3,
        wins: 1,
        losses: 1,
        winRate: 0.5,
        averageRR: 0.5
    });

    assert.throws(
        () => new NotionCapability({ notionService: null }),
        error => error.code === "NOTION_CAPABILITY_SERVICE_REQUIRED"
    );

    assert.strictEqual(capability.token, undefined);
    assert.strictEqual(capability.apiToken, undefined);
    assert.strictEqual(capability.notionClient, undefined);
    assert.strictEqual(capability.fetch, undefined);
    console.log("Notion Capability Service integration test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
