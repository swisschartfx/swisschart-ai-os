const assert = require("assert");
const { parseTradeId, newYorkYear, createNextTradeId } = require("./tradeIdContract");

function run() {
    assert.deepStrictEqual(parseTradeId("SCT-2646"), { yearSuffix: "26", sequence: 46 });
    for (const invalid of ["TSC-2646", "SCT-2600", "SCT-26100", "SCT-264", "SCT-M8-1", "sct-2646"]) assert.strictEqual(parseTradeId(invalid), null);
    assert.strictEqual(createNextTradeId(["SCT-2646"], new Date("2026-08-14T12:00:00Z")).tradeId, "SCT-2647");
    assert.strictEqual(createNextTradeId(["SCT-2646"], new Date("2027-01-01T05:00:00Z")).tradeId, "SCT-2701");
    assert.strictEqual(createNextTradeId(["SCT-2701"], new Date("2027-06-01T12:00:00Z")).tradeId, "SCT-2702");
    assert.strictEqual(createNextTradeId([], new Date("2028-06-01T12:00:00Z")).tradeId, "SCT-2801");
    assert.strictEqual(newYorkYear(new Date("2027-01-01T04:59:59.999Z")), 2026);
    assert.strictEqual(newYorkYear(new Date("2027-01-01T05:00:00.000Z")), 2027);
    assert.strictEqual(createNextTradeId(["SCT-2646", "TSC-2699", "SCT-bad"], new Date("2027-01-01T04:59:59.999Z")).tradeId, "SCT-2647");
    assert.throws(() => createNextTradeId(["SCT-2699"], new Date("2026-12-01T12:00:00Z"), 99), (error) => error.code === "TRADE_ID_YEAR_SEQUENCE_EXHAUSTED");
    console.log("Year-aware Trade ID contract tests passed");
}
run();
