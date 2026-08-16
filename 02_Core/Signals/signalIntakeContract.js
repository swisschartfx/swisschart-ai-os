const FOUNDER_COLLECTION_ORDER = Object.freeze(["pair", "direction", "entry", "stopLoss", "risk", "grade"]);
const TARGET_COLLECTION_ORDER = Object.freeze(["tp1", "tp2", "tp3"]);
const DOMAIN_INTENT_EXAMPLES = Object.freeze(["Signal", "سیگنال", "یه سیگنال دارم", "سیگنال بزن", "سیگنال منتشر کنیم", "publish signal"]);

function startSignalIntake() {
    return Object.freeze({ status: "collecting", domainIntent: "swisschart_signal_workflow", collectionMode: "one_field_at_a_time", nextField: "pair", nextPrompt: "Asset چیه؟", requiredFounderFields: [...FOUNDER_COLLECTION_ORDER], targetPolicy: "founder_supplied_until_authoritative_rule_exists", approvalRequired: false });
}
module.exports = { FOUNDER_COLLECTION_ORDER, TARGET_COLLECTION_ORDER, DOMAIN_INTENT_EXAMPLES, startSignalIntake };
