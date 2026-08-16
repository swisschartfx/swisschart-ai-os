const { createCloudRuntime } = require("./createCloudRuntime");

let runtime;
try {
    runtime = createCloudRuntime();
    runtime.start().catch(() => {
        console.error(JSON.stringify({
            level: "error",
            event: "cloud_runtime_start_failed"
        }));
        process.exitCode = 1;
    });
} catch (error) {
    console.error(JSON.stringify({
        level: "error",
        event: "cloud_runtime_configuration_failed",
        code: error && error.code || "CLOUD_CONFIGURATION_FAILED",
        missingVariables: error && error.missingVariables || undefined
    }));
    process.exitCode = 1;
}

module.exports = runtime;
