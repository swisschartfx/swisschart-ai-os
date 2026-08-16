const { assertValidRule } = require("./01_ruleContracts");

class RuleStore {
    constructor() {
        this.rules = new Map();
    }

    addRule(rule) {
        if (this.rules.has(rule && rule.id)) {
            const error = new Error(`Rule already exists: ${rule.id}`);
            error.code = "RULE_ALREADY_EXISTS";
            throw error;
        }

        assertValidRule(rule);
        const storedRule = clone(rule);
        this.rules.set(storedRule.id, storedRule);
        return clone(storedRule);
    }

    updateRule(id, updates) {
        if (!this.rules.has(id)) {
            const error = new Error(`Rule not found: ${id}`);
            error.code = "RULE_NOT_FOUND";
            throw error;
        }

        if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
            const error = new Error("Rule updates must be an object");
            error.code = "RULE_UPDATE_INVALID";
            throw error;
        }

        const existing = this.rules.get(id);
        const updatedRule = {
            ...existing,
            ...clone(updates),
            id
        };

        assertValidRule(updatedRule);
        this.rules.set(id, clone(updatedRule));
        return clone(updatedRule);
    }

    getRules() {
        return Array.from(this.rules.values(), clone);
    }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

module.exports = RuleStore;
