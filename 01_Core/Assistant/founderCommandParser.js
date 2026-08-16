const { randomUUID } = require("crypto");

class FounderCommandParser {
    constructor(options = {}) {
        this.automationIdGenerator = options.automationIdGenerator ||
            (() => `automation-${randomUUID()}`);
        this.clock = options.clock || (() => new Date());
    }

    parse(command) {
        const input = String(command || "").trim();
        const performanceCommands = new Set([
            "give me performance report",
            "show weekly performance",
            "publish performance summary",
            "\u06af\u0632\u0627\u0631\u0634 \u0639\u0645\u0644\u06a9\u0631\u062f \u0628\u062f\u0647",
            "\u06af\u0632\u0627\u0631\u0634 \u0627\u06cc\u0646 \u0647\u0641\u062a\u0647 \u0631\u0648 \u062f\u0631 \u062a\u0644\u06af\u0631\u0627\u0645 \u0645\u0646\u062a\u0634\u0631 \u06a9\u0646"
        ]);

        if (performanceCommands.has(input.toLowerCase())) {
            return {
                type: "performance_summary_publish"
            };
        }

        const scheduleTelegramMatch = input.match(
            /^schedule telegram message (.+) tomorrow at (1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(AM|PM)$/i
        );

        if (scheduleTelegramMatch) {
            const message = scheduleTelegramMatch[1].trim();
            const time = parseTwelveHourTime(
                scheduleTelegramMatch[2],
                scheduleTelegramMatch[3],
                scheduleTelegramMatch[4]
            );
            const executeAt = resolveIstanbulExecution(
                this.clock(),
                time,
                true
            );
            const automationId = this.automationIdGenerator();

            return {
                type: "automation",
                action: "create",
                automation: {
                    automationId,
                    name: `Scheduled Telegram message ${automationId}`,
                    enabled: true,
                    trigger: {
                        type: "schedule",
                        executeAt: executeAt.toISOString(),
                        timezone: "Europe/Istanbul"
                    },
                    action: {
                        intent: "content.publish",
                        objective: "Publish the scheduled Telegram message.",
                        capabilityRequirement: "publishing.publish",
                        input: {
                            message,
                            destination: "telegram.primary",
                            contentType: "text"
                        }
                    },
                    approvalPolicy: {
                        required: true
                    },
                    metadata: {
                        source: "founder_command"
                    }
                }
            };
        }

        const deleteTelegramMatch = input.match(
            /^delete scheduled telegram message (\S+)$/i
        );

        if (deleteTelegramMatch) {
            return {
                type: "automation",
                action: "delete",
                automationId: deleteTelegramMatch[1]
            };
        }

        const changeTelegramTimeMatch = input.match(
            /^change scheduled telegram message (\S+) time to (1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(AM|PM)$/i
        );

        if (changeTelegramTimeMatch) {
            const time = parseTwelveHourTime(
                changeTelegramTimeMatch[2],
                changeTelegramTimeMatch[3],
                changeTelegramTimeMatch[4]
            );
            const executeAt = resolveIstanbulExecution(
                this.clock(),
                time,
                false
            );

            return {
                type: "automation",
                action: "update",
                automationId: changeTelegramTimeMatch[1],
                updates: {
                    trigger: {
                        type: "schedule",
                        executeAt: executeAt.toISOString(),
                        timezone: "Europe/Istanbul"
                    }
                }
            };
        }

        const createMatch = input.match(
            /^create daily ([a-z0-9_-]+) automation at ([01]\d|2[0-3]):([0-5]\d)$/i
        );

        if (createMatch) {
            const capability = createMatch[1].toLowerCase();
            const time = `${createMatch[2]}:${createMatch[3]}`;

            return {
                type: "automation",
                action: "create",
                automation: {
                    automationId: this.automationIdGenerator(),
                    name: `Daily ${capability} automation at ${time}`,
                    enabled: true,
                    trigger: {
                        type: "schedule",
                        frequency: "daily",
                        time,
                        timezone: "Europe/Istanbul"
                    },
                    action: {
                        capability,
                        intent: `${capability}.execute`,
                        objective: `Execute the configured ${capability} automation.`,
                        capabilityRequirement: capability,
                        input: {}
                    },
                    approvalPolicy: {
                        required: true
                    },
                    metadata: {
                        source: "founder_command"
                    }
                }
            };
        }

        const stateMatch = input.match(
            /^(enable|disable) automation ([a-z0-9_-]+)$/i
        );

        if (stateMatch) {
            return {
                type: "automation",
                action: stateMatch[1].toLowerCase(),
                automationId: stateMatch[2]
            };
        }

        return null;
    }
}

function parseTwelveHourTime(hourValue, minuteValue, periodValue) {
    let hour = Number(hourValue) % 12;

    if (periodValue.toUpperCase() === "PM") {
        hour += 12;
    }

    return {
        hour,
        minute: Number(minuteValue || 0)
    };
}

function resolveIstanbulExecution(now, time, tomorrow) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    });
    const parts = Object.fromEntries(formatter.formatToParts(now)
        .filter(part => part.type !== "literal")
        .map(part => [part.type, Number(part.value)]));
    const dayOffset = tomorrow ? 1 : 0;
    let localAsUtc = new Date(Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day + dayOffset,
        time.hour,
        time.minute
    ));
    let executeAt = new Date(localAsUtc.getTime() - 3 * 60 * 60 * 1000);

    if (!tomorrow && executeAt.getTime() <= now.getTime()) {
        localAsUtc = new Date(localAsUtc.getTime() + 24 * 60 * 60 * 1000);
        executeAt = new Date(localAsUtc.getTime() - 3 * 60 * 60 * 1000);
    }

    return executeAt;
}

module.exports = FounderCommandParser;
