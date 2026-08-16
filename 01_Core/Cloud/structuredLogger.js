function createStructuredLogger(output = console) {
    function write(level, event, fields = {}) {
        const safeFields = sanitize(fields);
        const line = JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            event,
            ...safeFields
        });
        const method = level === "error" ? "error" : "log";
        output[method](line);
    }
    return {
        info(event, fields) { write("info", event, fields); },
        error(event, fields) { write("error", event, fields); }
    };
}

function sanitize(fields) {
    const safe = {};
    for (const [key, value] of Object.entries(fields || {})) {
        if (/token|secret|authorization|api.?key|record|input|data/i.test(key)) continue;
        if (["string", "number", "boolean"].includes(typeof value) || value === null) {
            safe[key] = value;
        }
    }
    return safe;
}

module.exports = { createStructuredLogger };
