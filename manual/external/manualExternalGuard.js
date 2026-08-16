function requireManualExternalAuthorization(options = {}) {
    const actionFlags = options.actionFlags || [];
    const missing = actionFlags.filter(
        name => process.env[name] !== "true"
    );

    if (
        process.env.SWISSCHART_ALLOW_REAL_EXTERNAL_ACTIONS !== "true" ||
        process.env.SWISSCHART_EXTERNAL_TARGET !== "production" ||
        missing.length > 0
    ) {
        const error = new Error(
            `Manual external action refused. Required explicit flags: ${[
                "SWISSCHART_ALLOW_REAL_EXTERNAL_ACTIONS=true",
                "SWISSCHART_EXTERNAL_TARGET=production",
                ...actionFlags.map(name => `${name}=true`)
            ].join(", ")}`
        );
        error.code = "MANUAL_EXTERNAL_ACTION_NOT_AUTHORIZED";
        throw error;
    }

    console.warn(
        `WARNING: PRODUCTION-CAPABLE MANUAL ACTION: ${options.description}`
    );
}

module.exports = { requireManualExternalAuthorization };
