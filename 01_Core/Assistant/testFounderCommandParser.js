const assert = require("assert");

const FounderCommandParser = require("./founderCommandParser");

function run() {
    const parser = new FounderCommandParser({
        automationIdGenerator: () => "automation-daily-0800"
    });

    const create = parser.parse(
        "create daily telegram automation at 08:00"
    );
    assert.strictEqual(create.type, "automation");
    assert.strictEqual(create.action, "create");
    assert.strictEqual(create.automation.automationId, "automation-daily-0800");
    assert.deepStrictEqual(create.automation.trigger, {
        type: "schedule",
        frequency: "daily",
        time: "08:00",
        timezone: "Europe/Istanbul"
    });
    assert.deepStrictEqual(create.automation.action, {
        capability: "telegram",
        intent: "telegram.execute",
        objective: "Execute the configured telegram automation.",
        capabilityRequirement: "telegram",
        input: {}
    });
    assert.strictEqual(create.automation.approvalPolicy.required, true);

    const enable = parser.parse("enable automation automation-id");
    assert.deepStrictEqual(enable, {
        type: "automation",
        action: "enable",
        automationId: "automation-id"
    });

    const disable = parser.parse("disable automation automation-id");
    assert.deepStrictEqual(disable, {
        type: "automation",
        action: "disable",
        automationId: "automation-id"
    });

    assert.strictEqual(parser.parse("publish something now"), null);
    console.log("Founder Command Parser tests passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
