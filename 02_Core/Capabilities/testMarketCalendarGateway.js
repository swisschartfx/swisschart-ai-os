const assert = require("assert");
const CapabilityRegistry = require("./capabilityRegistry");
const CapabilityGateway = require("./capabilityGateway");
const MarketCalendarCapability = require("./marketCalendarCapability");

(async () => {
    const capability = new MarketCalendarCapability({
        calendarService: {
            async getWeeklyCalendar() {
                return {
                    events: [{
                        title: "FOMC Meeting Minutes",
                        country: "USD",
                        date: "2026-08-19T14:00:00-04:00",
                        impact: "High",
                        forecast: "",
                        previous: ""
                    }],
                    sourceReference: "mock://forex-factory-weekly",
                    retrievedAt: "2026-08-17T12:00:00.000Z"
                };
            }
        }
    });
    const gateway = new CapabilityGateway({
        registry: new CapabilityRegistry([capability])
    });

    const result = await gateway.execute({
        requestId: "market-calendar-gateway-1",
        capability: "market.calendar",
        operation: "market.calendar.daily",
        input: { date: "2026-08-19" },
        context: {},
        constraints: {},
        metadata: { transport: "local-test" },
        requestedBy: "system",
        source: "morning-message-test",
        inputContractVersion: "1.0",
        timestamp: "2026-08-17T12:00:00.000Z"
    });

    assert.strictEqual(result.status, "completed");
    assert.strictEqual(result.data.events.length, 1);
    assert.strictEqual(result.data.events[0].currency, "USD");
    assert.strictEqual(result.executionMetadata.operationAccess, "read");

    console.log("Market Calendar Capability Gateway test passed");
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
