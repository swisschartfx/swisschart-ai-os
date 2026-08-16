const crypto = require("crypto");

const TRIGGER_TYPES = Object.freeze(["local_time", "session_relative"]);
const OCCURRENCE_STATES = Object.freeze([
    "planned", "claimed", "publishing", "completed",
    "failed_safe_to_retry", "delivery_uncertain", "held", "skipped",
    "suppressed", "cancelled"
]);
const DISPLAY_TIMEZONE = "America/New_York";

function normalizeSchedule(input, options = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw coded("SCHEDULE_REQUIRED", "Schedule is required");
    }
    const scheduleId = requiredString(input.scheduleId, "SCHEDULE_ID_REQUIRED");
    const name = requiredString(input.name, "SCHEDULE_NAME_REQUIRED");
    if (typeof input.enabled !== "boolean") {
        throw coded("SCHEDULE_ENABLED_REQUIRED", "Schedule enabled must be boolean");
    }
    const weekdays = normalizeWeekdays(input.weekdays);
    const trigger = normalizeTrigger(input.trigger);
    const publication = normalizePublication(input.publication);
    const executionPolicy = normalizeExecutionPolicy(input.executionPolicy);
    const priority = input.priority === undefined ? 100 : Number(input.priority);
    if (!Number.isInteger(priority)) {
        throw coded("SCHEDULE_PRIORITY_INVALID", "Schedule priority must be an integer");
    }
    return {
        scheduleId,
        revision: options.revision || Number(input.revision) || 1,
        name,
        enabled: input.enabled,
        weekdays,
        trigger,
        publication,
        executionPolicy,
        priority,
        tombstoned: input.tombstoned === true
    };
}

function normalizeWeekdays(value) {
    if (!Array.isArray(value) || value.length === 0) {
        throw coded("SCHEDULE_WEEKDAYS_REQUIRED", "At least one ISO weekday is required");
    }
    const weekdays = [...new Set(value.map(Number))].sort((a, b) => a - b);
    if (weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7)) {
        throw coded("SCHEDULE_WEEKDAY_INVALID", "ISO weekdays must be integers from 1 to 7");
    }
    return weekdays;
}

function normalizeTrigger(value) {
    if (!value || !TRIGGER_TYPES.includes(value.type)) {
        throw coded("SCHEDULE_TRIGGER_INVALID", "Unsupported schedule trigger type");
    }
    const timezone = requiredString(value.timezone, "SCHEDULE_TIMEZONE_REQUIRED");
    validateTimezone(timezone);
    const disambiguation = value.disambiguation || "reject";
    if (!["reject", "earlier", "later"].includes(disambiguation)) {
        throw coded("SCHEDULE_DISAMBIGUATION_INVALID", "Invalid DST disambiguation policy");
    }
    const offsetMinutes = value.offsetMinutes === undefined
        ? 0 : Number(value.offsetMinutes);
    if (!Number.isInteger(offsetMinutes) || Math.abs(offsetMinutes) > 1440) {
        throw coded("SCHEDULE_OFFSET_INVALID", "Offset minutes must be an integer within one day");
    }
    if (value.type === "local_time") {
        return {
            type: value.type,
            localTime: normalizeTime(value.localTime),
            timezone,
            offsetMinutes,
            disambiguation
        };
    }
    const session = requiredString(value.session, "SCHEDULE_SESSION_REQUIRED");
    const boundary = requiredString(value.boundary, "SCHEDULE_BOUNDARY_REQUIRED");
    if (!["open", "close"].includes(boundary)) {
        throw coded("SCHEDULE_BOUNDARY_INVALID", "Session boundary must be open or close");
    }
    return {
        type: value.type,
        session,
        boundary,
        authoritativeLocalTime: normalizeTime(value.authoritativeLocalTime),
        timezone,
        offsetMinutes,
        disambiguation
    };
}

function normalizePublication(value) {
    if (!value || value.destination !== "telegram.primary") {
        throw coded("SCHEDULE_DESTINATION_INVALID", "Only telegram.primary is supported");
    }
    if (!value.template || typeof value.template !== "object") {
        throw coded("SCHEDULE_TEMPLATE_REQUIRED", "Publication template is required");
    }
    const content = requiredString(value.template.content, "SCHEDULE_TEMPLATE_CONTENT_REQUIRED");
    const templateRevision = Number(value.template.revision);
    if (!Number.isInteger(templateRevision) || templateRevision < 1) {
        throw coded("SCHEDULE_TEMPLATE_REVISION_INVALID", "Template revision must be positive");
    }
    const displayTimezone = value.displayTimezone || DISPLAY_TIMEZONE;
    if (displayTimezone !== DISPLAY_TIMEZONE) {
        throw coded("SCHEDULE_DISPLAY_TIMEZONE_INVALID", "Channel display timezone must be America/New_York");
    }
    return {
        destination: value.destination,
        template: {
            templateId: requiredString(value.template.templateId,
                "SCHEDULE_TEMPLATE_ID_REQUIRED"),
            revision: templateRevision,
            content,
            contentHash: sha256(content)
        },
        displayTimezone,
        rendererVersion: requiredString(value.rendererVersion,
            "SCHEDULE_RENDERER_VERSION_REQUIRED")
    };
}

function normalizeExecutionPolicy(value = {}) {
    const misfireMode = value.misfireMode || "skip_and_record";
    if (misfireMode !== "skip_and_record") {
        throw coded("SCHEDULE_MISFIRE_MODE_INVALID", "Only skip_and_record is supported");
    }
    const grace = value.misfireGraceSeconds;
    if (grace !== null && grace !== undefined &&
        (!Number.isInteger(Number(grace)) || Number(grace) < 0)) {
        throw coded("SCHEDULE_MISFIRE_GRACE_INVALID", "Misfire grace must be null or a non-negative integer");
    }
    const holidayPolicy = value.holidayPolicy || "none";
    if (holidayPolicy !== "none") {
        throw coded("SCHEDULE_HOLIDAY_POLICY_INVALID", "Holiday intelligence is not implemented");
    }
    return {
        misfireMode,
        misfireGraceSeconds: grace === null || grace === undefined ? null : Number(grace),
        holidayPolicy
    };
}

function schedulePayloadHash(schedule) {
    return sha256(stable(schedule));
}

function occurrenceIdentity(schedule, localDate, resolvedInstant) {
    const identity = `schedule:${schedule.scheduleId}:revision:${schedule.revision}:` +
        `local-date:${localDate}:trigger:${resolvedInstant}`;
    return { identity, occurrenceKey: sha256(identity) };
}

function normalizeTime(value) {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || ""))) {
        throw coded("SCHEDULE_LOCAL_TIME_INVALID", "Local wall time must use HH:MM");
    }
    return value;
}

function validateTimezone(timezone) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); }
    catch (_) { throw coded("SCHEDULE_TIMEZONE_INVALID", "Timezone must be a valid IANA identity"); }
}

function requiredString(value, code) {
    if (typeof value !== "string" || !value.trim()) throw coded(code, code);
    return value.trim();
}
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort()
        .map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
}
function coded(code, message) { const error = new Error(message); error.code = code; return error; }

module.exports = {
    TRIGGER_TYPES, OCCURRENCE_STATES, DISPLAY_TIMEZONE,
    normalizeSchedule, schedulePayloadHash, occurrenceIdentity, stable
};
