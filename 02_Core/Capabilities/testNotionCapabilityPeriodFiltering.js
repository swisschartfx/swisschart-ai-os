const assert = require("assert");

const NotionCapability = require("./notionCapability");
const { PeriodResolver } = require("../Time/periodContract");

async function run() {
    const calls = [];
    const responses = [
        { records: [{ result: "Win", finalRR: 2 }] },
        { records: [] },
        { records: [{ result: "Loss", finalRR: -1 }] },
        { records: [{
            properties: {
                Result: { select: { name: "Win" } },
                "Final RR": { number: 2.5 },
                "Net RR": { number: 99 }
                , "Publish Date": { date: { start: "2026-08-02" } }
            }
        }, {
            properties: {
                Result: { select: { name: "Loss" } },
                "Final RR": { number: null },
                "Net RR": { number: -1 }
                , "Publish Date": { date: { start: "2026-08-03" } }
            }
        }] }
    ];
    const capability = new NotionCapability({
        clock: () => new Date("2026-08-13T12:00:00.000Z"),
        notionService: {
            async getDatabaseRecords(request) {
                calls.push(request);
                return responses.shift();
            }
        }
    });
    const period = new PeriodResolver({
        clock: () => new Date("2026-08-14T02:30:00.000Z")
    }).resolve({ contractVersion: "1.0", preset: "this_month",
        timezone: "America/New_York" });

    const allTime = await capability.execute({
        intent: "get_performance_summary",
        source: "trading_journal",
        databaseId: "journal-database"
    });
    assert.deepStrictEqual(calls[0], { databaseId: "journal-database" });
    assert.strictEqual(allTime.totalTrades, 1);
    assert.strictEqual(allTime.wins, 1);

    const currentMonth = await capability.execute({
        intent: "get_performance_summary",
        source: "trading_journal",
        databaseId: "journal-database",
        period
    });
    assert.deepStrictEqual(calls[1], {
        databaseId: "journal-database",
        filter: {
            and: [{
                property: "Publish Date",
                date: { on_or_after: "2026-08-01" }
            }, {
                property: "Publish Date",
                date: { before: "2026-08-14" }
            }]
        }
    });
    assert.strictEqual(currentMonth.totalTrades, 0);
    assert.strictEqual(currentMonth.winRate, 0);
    assert.strictEqual(currentMonth.netRR, 0);

    await capability.execute({
        intent: "get_performance_summary",
        source: "trading_journal",
        databaseId: "journal-database",
        period
    });
    assert.strictEqual(calls[2].filter.and[0].property, "Publish Date");

    const normalized = await capability.execute({
        intent: "get_normalized_trades",
        source: "trading_journal",
        databaseId: "journal-database",
        period
    });
    assert.deepStrictEqual(normalized, {
        records: [
            { result: "win", realizedRR: 2.5, tradeDate: "2026-08-02" },
            { result: "loss", realizedRR: -1, tradeDate: "2026-08-03" }
        ]
    });
    assert.strictEqual(calls[3].filter.and[0].property, "Publish Date");

    responses.push({ records: [] });
    await capability.execute({
        intent: "get_normalized_trades",
        source: "trading_journal",
        databaseId: "journal-database",
        period,
        filters: { status: "closed" }
    });
    assert.deepStrictEqual(calls[4].filter.and[2], {
        or: ["Win", "Loss", "BE"].map((name) => ({
            property: "Result",
            select: { equals: name }
        }))
    });

    const allPeriod = new PeriodResolver({
        clock: () => new Date("2026-08-14T02:30:00.000Z")
    }).resolve({ contractVersion: "1.0", preset: "all",
        timezone: "America/New_York" });
    responses.push({ records: [] });
    await capability.execute({
        intent: "get_performance_summary",
        source: "trading_journal",
        databaseId: "journal-database",
        period: allPeriod
    });
    assert.deepStrictEqual(calls[5], { databaseId: "journal-database" });

    responses.push({ records: [] });
    await capability.execute({
        intent: "get_normalized_trades",
        source: "trading_journal",
        databaseId: "journal-database",
        period: allPeriod,
        filters: { status: "closed" }
    });
    assert.deepStrictEqual(calls[6].filter.and, [{
        or: ["Win", "Loss", "BE"].map((name) => ({
            property: "Result",
            select: { equals: name }
        }))
    }]);

    await assert.rejects(
        () => capability.execute({
            intent: "get_performance_summary",
            source: "trading_journal",
            databaseId: "journal-database",
            period: "quarter_to_date"
        }),
        (error) => error.code === "PERIOD_NORMALIZED_INVALID"
    );

    console.log("Notion Capability period filtering tests passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
