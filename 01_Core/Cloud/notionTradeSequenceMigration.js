const PROPERTY_NAME = "Trade Sequence";
const FORMULA_EXPRESSION = 'if(test(prop("Trade ID"), "^SCT-\\d{2}(0[1-9]|[1-9]\\d)$"), toNumber(replaceAll(prop("Trade ID"), "^SCT-", "")), empty())';

function parseTradeSequence(value) {
    const match = typeof value === "string" ? value.match(/^SCT-(\d{2})(0[1-9]|[1-9]\d)$/) : null;
    return match ? Number(`${match[1]}${match[2]}`) : null;
}

function buildMigrationPlan(input) {
    if (!input || !input.dataSourceId || !input.primaryViewId) throw new Error("Migration identifiers are required");
    const records = Array.isArray(input.tradeIds) ? input.tradeIds : [];
    const valid = records.map((tradeId) => ({ tradeId, sequence: parseTradeSequence(tradeId) })).filter((item) => item.sequence !== null);
    const malformed = records.filter((tradeId) => parseTradeSequence(tradeId) === null);
    return Object.freeze({
        propertyName: PROPERTY_NAME,
        formulaExpression: FORMULA_EXPRESSION,
        validRecordCount: valid.length,
        malformedTradeIds: Object.freeze(malformed),
        expected: Object.freeze(valid),
        schemaMutation: Object.freeze({ properties: { [PROPERTY_NAME]: { formula: { expression: FORMULA_EXPRESSION } } } }),
        viewMutation: Object.freeze({ sorts: [{ property: PROPERTY_NAME, direction: "ascending" }] }),
        dataSourceId: input.dataSourceId,
        primaryViewId: input.primaryViewId
    });
}

function verifyComputedSequences(records, plan) {
    const byId = new Map(records.map((record) => [record.tradeId, record.sequence]));
    return plan.expected.every((item) => byId.get(item.tradeId) === item.sequence) &&
        plan.malformedTradeIds.every((tradeId) => byId.get(tradeId) === null);
}

module.exports = { PROPERTY_NAME, FORMULA_EXPRESSION, parseTradeSequence, buildMigrationPlan, verifyComputedSequences };
