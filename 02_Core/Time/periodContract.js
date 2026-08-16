const CONTRACT_VERSION = "1.0";
const BUSINESS_TIMEZONE = "America/New_York";
const MAX_EXPLICIT_RANGE_DAYS = 366;
const PRESETS = Object.freeze([
    "today", "yesterday", "this_week", "last_week", "this_month",
    "last_month", "last_30_days", "last_3_months", "year_to_date",
    "all", "explicit"
]);

class PeriodResolver {
    constructor(options = {}) {
        this.clock = options.clock || (() => new Date());
        this.timezone = options.timezone || BUSINESS_TIMEZONE;
        validateTimezone(this.timezone);
        if (this.timezone !== BUSINESS_TIMEZONE) {
            throw periodError("PERIOD_TIMEZONE_UNSUPPORTED",
                `Business timezone must be ${BUSINESS_TIMEZONE}`);
        }
    }

    resolve(input) {
        validateSemanticInput(input, this.timezone);
        const now = this.clock();
        if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
            throw periodError("PERIOD_CLOCK_INVALID", "Period clock returned an invalid date");
        }
        if (input.preset === "all") {
            return Object.freeze({
                preset: "all",
                unbounded: true,
                timezone: this.timezone,
                resolvedAt: now.toISOString(),
                contractVersion: CONTRACT_VERSION
            });
        }
        const today = localDateForInstant(now, this.timezone);
        const boundaries = resolveLocalBoundaries(input, today);
        const startInstant = localDateStartToInstant(
            boundaries.startLocalDate, this.timezone);
        const endInstantExclusive = localDateStartToInstant(
            boundaries.endLocalDateExclusive, this.timezone);
        return Object.freeze({
            startLocalDate: boundaries.startLocalDate,
            endLocalDateExclusive: boundaries.endLocalDateExclusive,
            startInstant: startInstant.toISOString(),
            endInstantExclusive: endInstantExclusive.toISOString(),
            timezone: this.timezone,
            resolvedAt: now.toISOString(),
            contractVersion: CONTRACT_VERSION
        });
    }
}

function validateSemanticInput(input, timezone) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw periodError("PERIOD_REQUIRED", "period must be an object");
    }
    if (input.contractVersion !== CONTRACT_VERSION) {
        throw periodError("PERIOD_VERSION_UNSUPPORTED", "period contractVersion is unsupported");
    }
    if (!PRESETS.includes(input.preset)) {
        throw periodError("PERIOD_PRESET_UNSUPPORTED", "period preset is unsupported");
    }
    validateTimezone(input.timezone);
    if (input.timezone !== timezone) {
        throw periodError("PERIOD_TIMEZONE_UNSUPPORTED",
            `period timezone must be ${timezone}`);
    }
    const allowed = new Set(["contractVersion", "preset", "timezone"]);
    if (input.preset === "explicit") {
        allowed.add("startDate");
        allowed.add("endDate");
        parseLocalDate(input.startDate, "startDate");
        parseLocalDate(input.endDate, "endDate");
        if (compareLocalDates(input.startDate, input.endDate) > 0) {
            throw periodError("PERIOD_RANGE_INVALID", "startDate must not be after endDate");
        }
        const span = daysBetween(input.startDate, addDays(input.endDate, 1));
        if (span > MAX_EXPLICIT_RANGE_DAYS) {
            throw periodError("PERIOD_RANGE_EXCESSIVE",
                `explicit period cannot exceed ${MAX_EXPLICIT_RANGE_DAYS} days`);
        }
    } else if (input.startDate !== undefined || input.endDate !== undefined) {
        throw periodError("PERIOD_FIELDS_INVALID",
            "startDate and endDate are allowed only for explicit periods");
    }
    if (Object.keys(input).some((key) => !allowed.has(key))) {
        throw periodError("PERIOD_FIELDS_INVALID", "period contains unsupported fields");
    }
}

function resolveLocalBoundaries(input, today) {
    const tomorrow = addDays(today, 1);
    switch (input.preset) {
    case "today": return range(today, tomorrow);
    case "yesterday": return range(addDays(today, -1), today);
    case "this_week": return range(startOfWeek(today), tomorrow);
    case "last_week": {
        const currentMonday = startOfWeek(today);
        return range(addDays(currentMonday, -7), currentMonday);
    }
    case "this_month": return range(startOfMonth(today), tomorrow);
    case "last_month": {
        const currentStart = startOfMonth(today);
        return range(addMonthsClamped(currentStart, -1), currentStart);
    }
    case "last_30_days": return range(addDays(today, -29), tomorrow);
    case "last_3_months": return range(addMonthsClamped(today, -3), tomorrow);
    case "year_to_date": return range(`${today.slice(0, 4)}-01-01`, tomorrow);
    case "explicit": return range(input.startDate, addDays(input.endDate, 1));
    default: throw periodError("PERIOD_PRESET_UNSUPPORTED", "period preset is unsupported");
    }
}

function validateNormalizedPeriod(period) {
    if (isUnboundedPeriod(period)) {
        const allowed = new Set(["preset", "unbounded", "timezone", "resolvedAt",
            "contractVersion"]);
        if (period.contractVersion !== CONTRACT_VERSION ||
            period.timezone !== BUSINESS_TIMEZONE ||
            typeof period.resolvedAt !== "string" ||
            Number.isNaN(Date.parse(period.resolvedAt)) ||
            Object.keys(period).some((field) => !allowed.has(field))) {
            throw periodError("PERIOD_NORMALIZED_INVALID",
                "normalized all-time period is invalid");
        }
        return period;
    }
    const required = ["startLocalDate", "endLocalDateExclusive", "startInstant",
        "endInstantExclusive", "timezone", "resolvedAt", "contractVersion"];
    if (!period || typeof period !== "object" || Array.isArray(period) ||
        required.some((field) => typeof period[field] !== "string")) {
        throw periodError("PERIOD_NORMALIZED_INVALID", "normalized period is invalid");
    }
    if (period.contractVersion !== CONTRACT_VERSION ||
        period.timezone !== BUSINESS_TIMEZONE) {
        throw periodError("PERIOD_NORMALIZED_INVALID", "normalized period metadata is invalid");
    }
    parseLocalDate(period.startLocalDate, "startLocalDate");
    parseLocalDate(period.endLocalDateExclusive, "endLocalDateExclusive");
    if (compareLocalDates(period.startLocalDate, period.endLocalDateExclusive) >= 0) {
        throw periodError("PERIOD_NORMALIZED_INVALID", "normalized period range is empty");
    }
    for (const field of ["startInstant", "endInstantExclusive", "resolvedAt"]) {
        if (Number.isNaN(Date.parse(period[field]))) {
            throw periodError("PERIOD_NORMALIZED_INVALID", `${field} is invalid`);
        }
    }
    const expectedStart = localDateStartToInstant(period.startLocalDate,
        BUSINESS_TIMEZONE).toISOString();
    const expectedEnd = localDateStartToInstant(period.endLocalDateExclusive,
        BUSINESS_TIMEZONE).toISOString();
    if (period.startInstant !== expectedStart || period.endInstantExclusive !== expectedEnd) {
        throw periodError("PERIOD_NORMALIZED_INVALID",
            "normalized period instants do not match New York dates");
    }
    return period;
}

function resolvePeriodInput(period, resolver = new PeriodResolver()) {
    if (period === "current_month") {
        return resolver.resolve({ contractVersion: CONTRACT_VERSION,
            preset: "this_month", timezone: BUSINESS_TIMEZONE });
    }
    if (period && typeof period === "object" &&
        (Object.hasOwn(period, "startLocalDate") || isUnboundedPeriod(period))) {
        return validateNormalizedPeriod(period);
    }
    return resolver.resolve(period);
}

function isUnboundedPeriod(period) {
    return Boolean(period && typeof period === "object" && !Array.isArray(period) &&
        period.preset === "all" && period.unbounded === true);
}

function resolveLocalDateTime(input) {
    if (!input || typeof input !== "object") {
        throw periodError("LOCAL_DATETIME_REQUIRED", "local datetime is required");
    }
    validateTimezone(input.timezone);
    if (input.timezone !== BUSINESS_TIMEZONE) {
        throw periodError("PERIOD_TIMEZONE_UNSUPPORTED",
            `timezone must be ${BUSINESS_TIMEZONE}`);
    }
    parseLocalDate(input.date, "date");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || "")) {
        throw periodError("LOCAL_TIME_INVALID", "time must use HH:MM");
    }
    const [hour, minute] = input.time.split(":").map(Number);
    const desired = { ...dateParts(input.date), hour, minute, second: 0 };
    const naive = Date.UTC(desired.year, desired.month - 1, desired.day, hour, minute);
    let candidate = new Date(naive);
    for (let attempt = 0; attempt < 4; attempt += 1) {
        const actual = zonedParts(candidate, input.timezone);
        const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day,
            actual.hour, actual.minute, actual.second);
        candidate = new Date(candidate.getTime() + naive - actualAsUtc);
    }
    const matches = [-2, -1, 0, 1, 2]
        .map((hours) => new Date(candidate.getTime() + hours * 3600000))
        .filter((value) => sameParts(zonedParts(value, input.timezone), desired))
        .filter((value, index, values) => index === 0 ||
            value.getTime() !== values[index - 1].getTime())
        .sort((left, right) => left - right);
    if (!matches.length) {
        throw periodError("LOCAL_TIME_NONEXISTENT",
            "local time does not exist because of a timezone transition");
    }
    if (matches.length > 1) {
        if (!['earlier', 'later'].includes(input.disambiguation)) {
            throw periodError("LOCAL_TIME_AMBIGUOUS",
                "ambiguous local time requires earlier or later disambiguation");
        }
        return (input.disambiguation === "earlier" ? matches[0] : matches.at(-1))
            .toISOString();
    }
    if (input.disambiguation !== undefined && input.disambiguation !== "compatible") {
        throw periodError("LOCAL_TIME_DISAMBIGUATION_INVALID",
            "disambiguation is not applicable to this local time");
    }
    return matches[0].toISOString();
}

function localDateStartToInstant(date, timezone) {
    return new Date(resolveLocalDateTime({ date, time: "00:00", timezone }));
}
function localDateForInstant(date, timezone) {
    const parts = zonedParts(date, timezone);
    return formatLocalDate(parts.year, parts.month, parts.day);
}
function zonedParts(date, timezone) {
    return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(date).filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]));
}
function validateTimezone(timezone) {
    if (typeof timezone !== "string") {
        throw periodError("PERIOD_TIMEZONE_INVALID", "timezone is required");
    }
    try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); }
    catch (cause) { throw periodError("PERIOD_TIMEZONE_INVALID", "timezone is not a valid IANA zone"); }
}
function parseLocalDate(value, field) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw periodError("PERIOD_DATE_INVALID", `${field} must use YYYY-MM-DD`);
    }
    const parts = dateParts(value);
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    if (formatLocalDate(date.getUTCFullYear(), date.getUTCMonth() + 1,
        date.getUTCDate()) !== value) {
        throw periodError("PERIOD_DATE_INVALID", `${field} is not a calendar date`);
    }
    return parts;
}
function dateParts(value) {
    const [year, month, day] = value.split("-").map(Number);
    return { year, month, day };
}
function addDays(value, days) {
    const parts = parseLocalDate(value, "date");
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    return formatLocalDate(date.getUTCFullYear(), date.getUTCMonth() + 1,
        date.getUTCDate());
}
function addMonthsClamped(value, months) {
    const parts = parseLocalDate(value, "date");
    const first = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
    const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
        .getUTCDate();
    return formatLocalDate(first.getUTCFullYear(), first.getUTCMonth() + 1,
        Math.min(parts.day, lastDay));
}
function startOfMonth(value) { return `${value.slice(0, 7)}-01`; }
function startOfWeek(value) {
    const parts = parseLocalDate(value, "date");
    const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    return addDays(value, -(day === 0 ? 6 : day - 1));
}
function daysBetween(start, endExclusive) {
    const left = parseLocalDate(start, "startDate");
    const right = parseLocalDate(endExclusive, "endDateExclusive");
    return (Date.UTC(right.year, right.month - 1, right.day) -
        Date.UTC(left.year, left.month - 1, left.day)) / 86400000;
}
function compareLocalDates(left, right) { return left.localeCompare(right); }
function formatLocalDate(year, month, day) {
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function sameParts(left, right) {
    return ["year", "month", "day", "hour", "minute", "second"]
        .every((field) => left[field] === right[field]);
}
function range(startLocalDate, endLocalDateExclusive) {
    return { startLocalDate, endLocalDateExclusive };
}
function periodError(code, message) { const error = new Error(message); error.code = code; return error; }

module.exports = {
    PeriodResolver, CONTRACT_VERSION, BUSINESS_TIMEZONE, MAX_EXPLICIT_RANGE_DAYS,
    PRESETS, validateNormalizedPeriod, resolvePeriodInput, resolveLocalDateTime,
    isUnboundedPeriod
};
