const assert = require("assert");

const NotionService = require("./notionService");

async function run() {
    const service = new NotionService();
    const result = await service.getDatabaseRecords({
        databaseId: "trading-journal-test"
    });

    assert.deepStrictEqual(result, {
        records: []
    });

    await assert.rejects(
        () => service.getDatabaseRecords({}),
        error => error.code === "NOTION_SERVICE_INPUT_INVALID" &&
            /databaseId/.test(error.message)
    );

    assert.strictEqual(service.token, undefined);
    assert.strictEqual(service.apiToken, undefined);
    assert.strictEqual(service.notionClient, undefined);
    assert.strictEqual(service.capability, undefined);
    console.log("Notion Service contract test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
