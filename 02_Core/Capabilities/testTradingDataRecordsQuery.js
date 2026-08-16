const assert = require("assert");

const TradingDataCapability = require("./tradingDataCapability");
const { PeriodResolver } = require("../Time/periodContract");

async function run() {
    const sourceRequests = [];
    const clock = () => new Date("2026-08-13T13:00:00.000Z");
    const capability = new TradingDataCapability({
        clock,
        tradingDataSource: {
            async execute(request) {
                sourceRequests.push(request);
                return {
                    records: [
                        { result: "win", realizedRR: 2 },
                        { result: "loss", realizedRR: -1 }
                    ]
                };
            }
        }
    });
    const currentMonth = new PeriodResolver({ clock }).resolve({
        contractVersion: "1.0", preset: "this_month",
        timezone: "America/New_York"
    });
    const result = await capability.execute({
        operation: "trading.records.query",
        input: {
            period: "current_month",
            requiredFields: ["result", "realizedRR"]
        }
    });

    assert.deepStrictEqual(sourceRequests, [{
        intent: "get_normalized_trades",
        source: "trading_journal",
        period: currentMonth
    }]);
    assert.deepStrictEqual(result.data.records, [
        { result: "win", realizedRR: 2 },
        { result: "loss", realizedRR: -1 }
    ]);
    assert.strictEqual(JSON.stringify(result).includes("properties"), false);
    assert.strictEqual(JSON.stringify(result).includes("databaseId"), false);

    console.log("Trading Data records query tests passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
