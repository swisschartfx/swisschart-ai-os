const fs = require("fs");
const path = require("path");

const CONFIG_PATH =
    path.join(__dirname, "systemConfig.json");

function loadConfig() {

    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(
            "System configuration file not found"
        );
    }

    const raw =
        fs.readFileSync(
            CONFIG_PATH,
            "utf8"
        );

    return JSON.parse(raw);
}

function getConfigValue(pathString) {

    if (!pathString) {
        throw new Error(
            "Configuration path is required"
        );
    }

    const config =
        loadConfig();

    const parts =
        pathString.split(".");

    let value =
        config;

    for (const part of parts) {

        if (
            value === undefined ||
            value === null ||
            !Object.prototype.hasOwnProperty.call(
                value,
                part
            )
        ) {
            return undefined;
        }

        value =
            value[part];
    }

    return value;
}

function setConfigValue(
    pathString,
    newValue
) {

    if (!pathString) {
        throw new Error(
            "Configuration path is required"
        );
    }

    const config =
        loadConfig();

    const parts =
        pathString.split(".");

    let target =
        config;

    for (
        let i = 0;
        i < parts.length - 1;
        i++
    ) {

        const part =
            parts[i];

        if (
            target[part] === undefined ||
            target[part] === null ||
            typeof target[part] !== "object"
        ) {
            throw new Error(
                `Invalid configuration path: ${pathString}`
            );
        }

        target =
            target[part];
    }

    const finalKey =
        parts[parts.length - 1];

    if (
        !Object.prototype.hasOwnProperty.call(
            target,
            finalKey
        )
    ) {
        throw new Error(
            `Configuration key does not exist: ${pathString}`
        );
    }

    target[finalKey] =
        newValue;

    const output =
        JSON.stringify(
            config,
            null,
            2
        );

    fs.writeFileSync(
        CONFIG_PATH,
        output,
        {
            encoding: "utf8"
        }
    );

    return newValue;
}

module.exports = {
    loadConfig,
    getConfigValue,
    setConfigValue
};
