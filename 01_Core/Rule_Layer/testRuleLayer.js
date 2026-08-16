const assert = require("assert");

const {
    RULE_MODES,
    RULE_STATUSES,
    validateRule
} = require("./01_ruleContracts");
const RuleStore = require("./02_ruleStore");
const RuleResolver = require("./03_ruleResolver");

const timestamp = "2026-08-12T12:00:00.000Z";

function createRule(overrides) {
    return {
        id: overrides.id,
        name: overrides.name,
        scope: overrides.scope,
        action: overrides.action,
        mode: overrides.mode,
        priority: overrides.priority,
        status: RULE_STATUSES.ACTIVE,
        createdBy: "founder",
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function run() {
    const store = new RuleStore();
    const resolver = new RuleResolver({ ruleStore: store });

    const telegramDefault = resolver.resolve("publishing.external", {
        platform: "telegram"
    });
    assert.strictEqual(telegramDefault.mode, RULE_MODES.APPROVAL_REQUIRED);
    assert.strictEqual(telegramDefault.source, "default");

    const forexFactoryRule = createRule({
        id: "rule-forex-factory-high-impact",
        name: "Forex Factory high impact notification",
        scope: {
            source: "forex_factory",
            impact: "high"
        },
        action: "founder.notify",
        mode: RULE_MODES.NOTIFICATION_ONLY,
        priority: 100
    });
    assert.strictEqual(validateRule(forexFactoryRule).valid, true);
    store.addRule(forexFactoryRule);

    const highImpactNotification = resolver.resolve("founder.notify", {
        source: "forex_factory",
        impact: "high",
        event: "CPI"
    });
    assert.strictEqual(highImpactNotification.mode, RULE_MODES.NOTIFICATION_ONLY);
    assert.strictEqual(highImpactNotification.rule.id, forexFactoryRule.id);

    store.addRule(createRule({
        id: "rule-general-market-notification",
        name: "General market notification",
        scope: { category: "market_session" },
        action: "founder.notify",
        mode: RULE_MODES.NOTIFICATION_ONLY,
        priority: 50
    }));

    store.addRule(createRule({
        id: "rule-london-open-automatic",
        name: "London Open notification",
        scope: {
            category: "market_session",
            event: "london_open"
        },
        action: "founder.notify",
        mode: RULE_MODES.AUTOMATIC,
        priority: 200
    }));

    const londonOpen = resolver.resolve("founder.notify", {
        category: "market_session",
        event: "london_open"
    });
    assert.strictEqual(londonOpen.mode, RULE_MODES.AUTOMATIC);
    assert.strictEqual(londonOpen.rule.id, "rule-london-open-automatic");

    const updated = store.updateRule("rule-london-open-automatic", {
        name: "London Open automatic founder notification",
        updatedAt: "2026-08-12T12:05:00.000Z"
    });
    assert.strictEqual(updated.name, "London Open automatic founder notification");
    assert.strictEqual(store.getRules().length, 3);

    console.log("Rule Layer tests passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
