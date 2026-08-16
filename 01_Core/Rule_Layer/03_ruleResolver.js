const { RULE_MODES, RULE_STATUSES } = require("./01_ruleContracts");

class RuleResolver {
    constructor(options = {}) {
        this.ruleStore = options.ruleStore || null;
        this.defaultMode = options.defaultMode || RULE_MODES.APPROVAL_REQUIRED;
    }

    resolve(action, scope, rules) {
        if (typeof action !== "string" || !action.trim()) {
            throw new Error("action is required to resolve a rule");
        }

        const availableRules = rules || (this.ruleStore ? this.ruleStore.getRules() : []);
        const matches = availableRules
            .filter((rule) => rule.status === RULE_STATUSES.ACTIVE)
            .filter((rule) => actionMatches(rule.action, action))
            .filter((rule) => scopeMatches(rule.scope, scope))
            .sort(compareRules);

        if (matches.length === 0) {
            return {
                mode: this.defaultMode,
                rule: null,
                source: "default"
            };
        }

        return {
            mode: matches[0].mode,
            rule: matches[0],
            source: "rule"
        };
    }
}

function actionMatches(ruleAction, requestedAction) {
    return ruleAction === "*" || ruleAction === requestedAction;
}

function scopeMatches(ruleScope, requestedScope) {
    if (ruleScope === "*") {
        return true;
    }

    if (typeof ruleScope === "string") {
        return ruleScope === requestedScope;
    }

    if (!requestedScope || typeof requestedScope !== "object" || Array.isArray(requestedScope)) {
        return false;
    }

    return Object.entries(ruleScope).every(([key, value]) => {
        return value === "*" || requestedScope[key] === value;
    });
}

function compareRules(left, right) {
    if (right.priority !== left.priority) {
        return right.priority - left.priority;
    }

    const specificityDifference = scopeSpecificity(right.scope) - scopeSpecificity(left.scope);
    if (specificityDifference !== 0) {
        return specificityDifference;
    }

    const updatedDifference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    if (updatedDifference !== 0) {
        return updatedDifference;
    }

    return left.id.localeCompare(right.id);
}

function scopeSpecificity(scope) {
    if (scope === "*") {
        return 0;
    }

    if (typeof scope === "string") {
        return 1;
    }

    return Object.values(scope).filter((value) => value !== "*").length;
}

module.exports = RuleResolver;
