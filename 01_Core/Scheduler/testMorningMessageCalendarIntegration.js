const assert = require("assert");
const ScheduledEventPublicationRenderer = require("./scheduledEventPublicationRenderer");
const { createMarketSessionSchedules } = require("../../02_Core/Time/marketSessionSchedules");

function eventForMorning() {
    const schedule = createMarketSessionSchedules().find(item =>
        item.scheduleId === "market.london.preopen_60m"
    );
    return {
        name: schedule.scheduleId,
        executeAt: "2026-08-17T06:00:00.000Z",
        metadata: {
            taskPayload: { input: { message: schedule.publication.template.content } },
            publicationRender: {
                rendererVersion: schedule.publication.rendererVersion,
                templateId: schedule.publication.template.templateId,
                templateRevision: schedule.publication.template.revision,
                displayTimezone: schedule.publication.displayTimezone,
                baseContent: schedule.publication.template.content
            },
            approvedScheduleGrant: {
                rendererVersion: schedule.publication.rendererVersion
            }
        }
    };
}

(async () => {
    let request;
    const renderer = new ScheduledEventPublicationRenderer({
        capabilityGateway: {
            async execute(value) {
                request = value;
                return {
                    status: "completed",
                    data: {
                        date: "2026-08-17",
                        timezone: "America/New_York",
                        highImpactEvents: [
                            { title: "Retail Sales", currency: "USD", scheduledAt: "2026-08-17T12:30:00.000Z" }
                        ],
                        bankHolidays: []
                    }
                };
            }
        },
        logger: { warn() { throw new Error("unexpected warning"); } }
    });
    const rendered = await renderer.render(eventForMorning());
    assert.strictEqual(request.capability, "market.calendar");
    assert.strictEqual(request.operation, "market.calendar.daily");
    assert.strictEqual(request.input.date, "2026-08-17");
    assert(rendered.metadata.taskPayload.input.message.includes(
        "08:30 — USD Retail Sales"
    ));
    assert.strictEqual(rendered.metadata.approvedScheduleGrant.renderContext.status,
        "available");

    let warnings = 0;
    const unavailable = new ScheduledEventPublicationRenderer({
        capabilityGateway: { async execute() { return {
            code: "CAPABILITY_EXECUTION_FAILED", retryable: true
        }; } },
        logger: { warn() { warnings += 1; } }
    });
    const failed = await unavailable.render(eventForMorning());
    assert.strictEqual(warnings, 1);
    assert.strictEqual(failed.metadata.approvedScheduleGrant.renderContext.status,
        "unavailable");
    assert(!failed.metadata.taskPayload.input.message.includes(
        "No high-impact news scheduled today"
    ));

    console.log("Morning Message market.calendar scheduler integration tests passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
