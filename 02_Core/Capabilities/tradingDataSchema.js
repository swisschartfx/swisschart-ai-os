const TRADING_DATA_SCHEMA_VERSION = "1.0";

const FIELDS = Object.freeze([{
    fieldId: "result",
    type: "string",
    description: "Normalized closed-trade outcome such as win, loss or break_even",
    nullable: false,
    sortable: false,
    filterable: true,
    semanticMeaning: "trade_outcome"
}, {
    fieldId: "realizedRR",
    type: "number",
    description: "Realized trade performance measured in risk-reward units",
    nullable: true,
    sortable: true,
    filterable: true,
    semanticMeaning: "realized_return_in_rr"
}, {
    fieldId: "tradeDate",
    type: "date",
    description: "Canonical chronological trade journal date",
    nullable: true,
    sortable: true,
    filterable: true,
    semanticMeaning: "trade_chronology"
}]);

function getTradingDataSchema() {
    return {
        schemaVersion: TRADING_DATA_SCHEMA_VERSION,
        entity: "normalized_trade",
        fields: FIELDS.map((field) => ({ ...field }))
    };
}

module.exports = { TRADING_DATA_SCHEMA_VERSION, getTradingDataSchema };
