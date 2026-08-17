const { createCapabilityRequest, RESULT_STATUSES } = require(
    "../../02_Core/Capabilities/capabilityContract"
);
const { MARKET_CALENDAR_DAILY } = require(
    "../../02_Core/Capabilities/marketCalendarCapability"
);
const {
    MORNING_CALENDAR_RENDERER_VERSION,
    DISPLAY_TIMEZONE,
    renderMorningMessage
} = require("../../02_Core/Time/morningMessageRenderer");

class ScheduledEventPublicationRenderer {
    constructor(options = {}) {
        if (!options.capabilityGateway ||
            typeof options.capabilityGateway.execute !== "function") {
            throw new Error("Scheduled Event Publication Renderer requires Capability Gateway");
        }
        this.capabilityGateway = options.capabilityGateway;
        this.logger = options.logger || console;
    }

    async render(scheduledEvent) {
        const descriptor = scheduledEvent && scheduledEvent.metadata &&
            scheduledEvent.metadata.publicationRender;
        if (!descriptor || descriptor.rendererVersion !==
            MORNING_CALENDAR_RENDERER_VERSION) return scheduledEvent;

        const rendered = structuredClone(scheduledEvent);
        const tradingDate = formatLocalDate(
            rendered.executeAt,
            descriptor.displayTimezone || DISPLAY_TIMEZONE
        );

        let result;
        try {
            result = await this.capabilityGateway.execute(createCapabilityRequest({
                capability: "market.calendar",
                operation: MARKET_CALENDAR_DAILY,
                input: { date: tradingDate },
                context: {},
                constraints: {},
                metadata: { scheduleId: rendered.name },
                requestedBy: "scheduler-runtime",
                source: "approved-schedule",
                inputContractVersion: "1.0"
            }));
        } catch (error) {
            this.logFailure(error && error.code || "MARKET_CALENDAR_UNAVAILABLE");
            return applyRenderContext(rendered, descriptor, { status: "unavailable" });
        }

        if (!result || result.status !== RESULT_STATUSES.COMPLETED) {
            const code = result && result.code || "MARKET_CALENDAR_UNAVAILABLE";
            this.logFailure(code);
            return applyRenderContext(rendered, descriptor, { status: "unavailable" });
        }

        const data = result.data || {};
        return applyRenderContext(rendered, descriptor, {
            status: "available",
            date: data.date,
            timezone: data.timezone,
            highImpactEvents: projectEvents(data.highImpactEvents),
            bankHolidays: projectEvents(data.bankHolidays)
        });
    }

    logFailure(code) {
        if (this.logger && typeof this.logger.warn === "function") {
            this.logger.warn(JSON.stringify({
                level: "warn",
                event: "morning_calendar_unavailable",
                code
            }));
        }
    }
}

function applyRenderContext(event, descriptor, renderContext) {
    const message = renderMorningMessage(descriptor.baseContent, renderContext);
    event.metadata.taskPayload.input.message = message;
    event.metadata.approvedScheduleGrant.renderContext = renderContext;
    return event;
}

function projectEvents(events) {
    if (!Array.isArray(events)) return [];
    return events.map(event => ({
        title: event.title,
        currency: event.currency,
        scheduledAt: event.scheduledAt,
        allDay: event.allDay === true,
        isBankHoliday: event.isBankHoliday === true
    }));
}

function formatLocalDate(value, timezone) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        const error = new Error("Scheduled occurrence timestamp is invalid");
        error.code = "SCHEDULE_RENDER_TIMESTAMP_INVALID";
        throw error;
    }
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const mapped = Object.fromEntries(parts
        .filter(part => part.type !== "literal")
        .map(part => [part.type, part.value]));
    return `${mapped.year}-${mapped.month}-${mapped.day}`;
}

module.exports = ScheduledEventPublicationRenderer;
