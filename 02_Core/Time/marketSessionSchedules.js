const {
    getMarketSessionBoundary
} = require("./marketSessionDefinitions");

const WEEKDAYS = Object.freeze([1, 2, 3, 4, 5]);

function sessionTrigger(sessionId, boundary, offsetMinutes) {
    const session = getMarketSessionBoundary(sessionId, boundary);

    return {
        type: "session_relative",
        session: session.sessionId,
        boundary: session.boundary,
        authoritativeLocalTime: session.localTime,
        timezone: session.timezone,
        offsetMinutes,
        disambiguation: "reject"
    };
}

function publication(templateId, content, rendererVersion = "1.0") {
    return {
        destination: "telegram.primary",
        template: {
            templateId,
            revision: 1,
            content
        },
        displayTimezone: "America/New_York",
        rendererVersion
    };
}

function executionPolicy() {
    return {
        misfireMode: "skip_and_record",
        misfireGraceSeconds: 60,
        holidayPolicy: "none"
    };
}

function createMarketSessionSchedules() {
    return [
        {
            scheduleId: "market.london.preopen_60m",
            name: "London Open - 60 Minutes Before",
            enabled: false,
            weekdays: WEEKDAYS,
            trigger: sessionTrigger("london", "open", -60),
            publication: publication(
                "market.london.preopen_60m",
                `Good morning traders

London session opens in 1 hour

Stay focused and wait for clean setups

As precise as a Swiss watch

<a href="https://linktr.ee/swisschart">Swisschart Links</a>`,
                "morning-calendar.v1"
            ),
            executionPolicy: executionPolicy(),
            priority: 100
        },
        {
            scheduleId: "market.london.preopen_5m",
            name: "London Open - 5 Minutes Before",
            enabled: false,
            weekdays: WEEKDAYS,
            trigger: sessionTrigger("london", "open", -5),
            publication: publication(
                "market.london.preopen_5m",
                `London session opens in 5 minutes

Stay focused and wait for clean execution

As precise as a Swiss watch

<a href="https://linktr.ee/swisschart">Swisschart Links</a>`
            ),
            executionPolicy: executionPolicy(),
            priority: 100
        },
        {
            scheduleId: "market.london.preclose_5m",
            name: "London Close - 5 Minutes Before",
            enabled: false,
            weekdays: WEEKDAYS,
            trigger: sessionTrigger("london", "close", -5),
            publication: publication(
                "market.london.preclose_5m",
                `London session closes in 5 minutes

Review your open positions and manage your risk

As precise as a Swiss watch

<a href="https://linktr.ee/swisschart">Swisschart Links</a>`
            ),
            executionPolicy: executionPolicy(),
            priority: 100
        },
        {
            scheduleId: "market.newyork.preopen_5m",
            name: "New York Open - 5 Minutes Before",
            enabled: false,
            weekdays: WEEKDAYS,
            trigger: sessionTrigger("new_york", "open", -5),
            publication: publication(
                "market.newyork.preopen_5m",
                `New York session opens in 5 minutes

Stay focused and wait for clean execution

As precise as a Swiss watch

<a href="https://linktr.ee/swisschart">Swisschart Links</a>`
            ),
            executionPolicy: executionPolicy(),
            priority: 100
        },
        {
            scheduleId: "market.newyork.preclose_5m",
            name: "New York Close - 5 Minutes Before / End Of Day",
            enabled: false,
            weekdays: WEEKDAYS,
            trigger: sessionTrigger("new_york", "close", -5),
            publication: publication(
                "market.newyork.preclose_5m",
                `New York session closes in 5 minutes

Today's trading day is coming to an end
Swisschart channel activity is now concluded for today

See you next trading day

As precise as a Swiss watch

<a href="https://linktr.ee/swisschart">Swisschart Links</a>`
            ),
            executionPolicy: executionPolicy(),
            priority: 110
        }
    ];
}

module.exports = {
    WEEKDAYS,
    createMarketSessionSchedules
};