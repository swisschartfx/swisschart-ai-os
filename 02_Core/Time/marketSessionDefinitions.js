const MARKET_SESSIONS = Object.freeze({
    london: Object.freeze({
        sessionId: "london",
        timezone: "Europe/London",
        open: "08:00",
        close: "17:00"
    }),

    new_york: Object.freeze({
        sessionId: "new_york",
        timezone: "America/New_York",
        open: "08:00",
        close: "17:00"
    })
});

function getMarketSession(sessionId) {
    const session = MARKET_SESSIONS[sessionId];

    if (!session) {
        const error = new Error(`Unknown market session: ${sessionId}`);
        error.code = "MARKET_SESSION_UNKNOWN";
        throw error;
    }

    return session;
}

function getMarketSessionBoundary(sessionId, boundary) {
    const session = getMarketSession(sessionId);

    if (!["open", "close"].includes(boundary)) {
        const error = new Error(`Unknown market session boundary: ${boundary}`);
        error.code = "MARKET_SESSION_BOUNDARY_INVALID";
        throw error;
    }

    return {
        sessionId: session.sessionId,
        boundary,
        timezone: session.timezone,
        localTime: session[boundary]
    };
}

module.exports = {
    MARKET_SESSIONS,
    getMarketSession,
    getMarketSessionBoundary
};