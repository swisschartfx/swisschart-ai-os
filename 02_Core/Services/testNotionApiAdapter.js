const assert = require("assert");

const NotionService = require("./notionService");

async function run() {
    const missingToken = new NotionService({ env: {}, fetch: async () => {} });
    await assert.rejects(
        () => missingToken.getDatabaseRecords({ databaseId: "database-1" }),
        error => error.code === "NOTION_API_TOKEN_REQUIRED"
    );

    const missingDatabase = new NotionService({
        env: { NOTION_API_TOKEN: "test-token" },
        fetch: async () => {}
    });
    await assert.rejects(
        () => missingDatabase.getDatabaseRecords({}),
        error => error.code === "NOTION_DATABASE_ID_REQUIRED"
    );

    const calls = [];
    const service = new NotionService({
        env: { NOTION_API_TOKEN: "test-token" },
        fetch: async (url, options) => {
            calls.push({ url, options });
            return {
                ok: true,
                async json() {
                    return { results: [{ id: "record-1" }] };
                }
            };
        }
    });
    const result = await service.getDatabaseRecords({
        databaseId: "database/id"
    });

    assert.deepStrictEqual(result, {
        records: [{ id: "record-1" }]
    });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(
        calls[0].url,
        "https://api.notion.com/v1/databases/database%2Fid/query"
    );
    assert.strictEqual(calls[0].options.method, "POST");
    assert.strictEqual(
        calls[0].options.headers.Authorization,
        "Bearer test-token"
    );
    assert.strictEqual(
        calls[0].options.headers["Notion-Version"],
        "2022-06-28"
    );
    assert.strictEqual(calls[0].options.body, "{}");

    assert.strictEqual(service.token, undefined);
    assert.strictEqual(service.apiToken, undefined);
    console.log("Notion API Adapter test passed");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
