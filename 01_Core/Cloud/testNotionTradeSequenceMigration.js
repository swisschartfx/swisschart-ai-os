const assert = require("assert");
const { FORMULA_EXPRESSION, parseTradeSequence, buildMigrationPlan, verifyComputedSequences } = require("./notionTradeSequenceMigration");

function run() {
    assert.strictEqual(parseTradeSequence("SCT-2644"), 2644);
    assert.strictEqual(parseTradeSequence("TSC-2645"), null);
    assert.strictEqual(parseTradeSequence("SCT-2646"), 2646);
    assert.strictEqual(parseTradeSequence("SCT-2701"), 2701);
    for (const invalid of ["SCT-2600", "SCT-M8-123", "SCT-X", "2647", "", null]) assert.strictEqual(parseTradeSequence(invalid), null);
    const plan = buildMigrationPlan({ dataSourceId: "data-source", primaryViewId: "view", tradeIds: ["SCT-2644", "SCT-2645", "SCT-2646", "TSC-2645", "bad"] });
    assert.strictEqual(plan.validRecordCount, 3);
    assert.deepStrictEqual(plan.malformedTradeIds, ["TSC-2645", "bad"]);
    assert.deepStrictEqual(plan.viewMutation, { sorts: [{ property: "Trade Sequence", direction: "ascending" }] });
    assert.strictEqual(plan.schemaMutation.properties["Trade Sequence"].formula.expression, FORMULA_EXPRESSION);
    assert.strictEqual(verifyComputedSequences([{ tradeId: "SCT-2644", sequence: 2644 }, { tradeId: "SCT-2645", sequence: 2645 }, { tradeId: "SCT-2646", sequence: 2646 }, { tradeId: "TSC-2645", sequence: null }, { tradeId: "bad", sequence: null }], plan), true);
    assert.strictEqual(verifyComputedSequences([{ tradeId: "SCT-2644", sequence: 1 }], plan), false);
    console.log("Notion Trade Sequence migration dry-run tests passed");
}
run();
