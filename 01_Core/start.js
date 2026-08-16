const runtime = require("./bootstrap");

if (process.env.SWISSCHART_ENABLE_LEGACY_SCHEDULER === "true") {
    console.warn(
        "WARNING: starting legacy JSON-backed scheduler by explicit manual opt-in"
    );
    runtime.schedulerRuntime.start();
}

module.exports = runtime;
