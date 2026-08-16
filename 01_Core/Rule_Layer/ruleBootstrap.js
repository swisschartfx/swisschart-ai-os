const RuleStore = require("./02_ruleStore");
const defaultRules = require("./defaultRules");

const ruleStore = new RuleStore();

for (const rule of defaultRules) {
    ruleStore.addRule(rule);
}

module.exports = ruleStore;
