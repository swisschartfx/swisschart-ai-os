const {
    RULE_MODES,
    RULE_STATUSES,
    assertValidRule
} = require("./01_ruleContracts");

const DEFAULT_RULE_TIMESTAMP = "2026-08-12T00:00:00.000Z";

const DEFAULT_RULES = [
    {
        id: "default-telegram-external-publishing",
        name: "Telegram External Publishing",
        scope: { platform: "telegram" },
        action: "publishing.external",
        mode: RULE_MODES.APPROVAL_REQUIRED,
        priority: 100,
        status: RULE_STATUSES.ACTIVE,
        createdBy: "system",
        createdAt: DEFAULT_RULE_TIMESTAMP,
        updatedAt: DEFAULT_RULE_TIMESTAMP
    },
    {
        id: "default-forex-factory-high-impact-founder-notification",
        name: "Forex Factory High Impact Founder Notification",
        scope: {
            source: "forex_factory",
            impact: "high"
        },
        action: "founder.notify",
        mode: RULE_MODES.NOTIFICATION_ONLY,
        priority: 200,
        status: RULE_STATUSES.ACTIVE,
        createdBy: "system",
        createdAt: DEFAULT_RULE_TIMESTAMP,
        updatedAt: DEFAULT_RULE_TIMESTAMP
    },
    {
        id: "default-economic-news-external-publishing",
        name: "Economic News External Publishing",
        scope: { eventType: "economic_calendar" },
        action: "publishing.external",
        mode: RULE_MODES.APPROVAL_REQUIRED,
        priority: 200,
        status: RULE_STATUSES.ACTIVE,
        createdBy: "system",
        createdAt: DEFAULT_RULE_TIMESTAMP,
        updatedAt: DEFAULT_RULE_TIMESTAMP
    },
    {
        id: "default-london-open-founder-notification",
        name: "London Open Founder Notification",
        scope: {
            eventType: "scheduled",
            category: "market_session",
            event: "london_open"
        },
        action: "founder.notify",
        mode: RULE_MODES.AUTOMATIC,
        priority: 300,
        status: RULE_STATUSES.ACTIVE,
        createdBy: "system",
        createdAt: DEFAULT_RULE_TIMESTAMP,
        updatedAt: DEFAULT_RULE_TIMESTAMP
    }
];

for (const rule of DEFAULT_RULES) {
    assertValidRule(rule);
    Object.freeze(rule.scope);
    Object.freeze(rule);
}

module.exports = Object.freeze(DEFAULT_RULES);
