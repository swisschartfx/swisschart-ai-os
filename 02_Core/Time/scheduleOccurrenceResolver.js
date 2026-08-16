const { Temporal } = require("@js-temporal/polyfill");
const { occurrenceIdentity } = require("../../01_Core/Automation_Manager/scheduleContract");

class ScheduleOccurrenceResolver {
    resolve(schedule, localDate) {
        const date = Temporal.PlainDate.from(localDate);
        if (!schedule.weekdays.includes(date.dayOfWeek)) return null;
        const trigger = schedule.trigger;
        const wallTime = trigger.type === "session_relative"
            ? trigger.authoritativeLocalTime : trigger.localTime;
        const [hour, minute] = wallTime.split(":").map(Number);
        const plain = date.toPlainDateTime({ hour, minute });
        const earlier = plain.toZonedDateTime(trigger.timezone,
            { disambiguation: "earlier" });
        const later = plain.toZonedDateTime(trigger.timezone,
            { disambiguation: "later" });
        const earlierMatches = samePlain(earlier.toPlainDateTime(), plain);
        const laterMatches = samePlain(later.toPlainDateTime(), plain);
        if (!earlierMatches && !laterMatches) {
            throw coded("SCHEDULE_LOCAL_TIME_NONEXISTENT",
                `Local time ${localDate} ${wallTime} does not exist in ${trigger.timezone}`);
        }
        const ambiguous = earlierMatches && laterMatches &&
            earlier.epochNanoseconds !== later.epochNanoseconds;
        if (ambiguous && !["earlier", "later"].includes(trigger.disambiguation)) {
            throw coded("SCHEDULE_LOCAL_TIME_AMBIGUOUS",
                `Local time ${localDate} ${wallTime} is ambiguous in ${trigger.timezone}`);
        }
        const zoned = ambiguous && trigger.disambiguation === "later" ? later : earlier;
        const instant = zoned.toInstant().add({ minutes: trigger.offsetMinutes || 0 });
        const resolvedInstant = instant.toString();
        return {
            scheduleId: schedule.scheduleId,
            revision: schedule.revision,
            localDate: date.toString(),
            isoWeekday: date.dayOfWeek,
            authoritativeTimezone: trigger.timezone,
            authoritativeLocalTime: wallTime,
            offsetMinutes: trigger.offsetMinutes || 0,
            resolvedInstant,
            display: this.formatForChannel(instant),
            ...occurrenceIdentity(schedule, date.toString(), resolvedInstant)
        };
    }

    formatForChannel(instant) {
        const value = instant.toZonedDateTimeISO("America/New_York");
        return {
            timezone: "America/New_York",
            localDate: value.toPlainDate().toString(),
            localTime: value.toPlainTime().toString({ smallestUnit: "minute" }),
            offset: value.offset,
            instant: instant.toString()
        };
    }
}

function samePlain(a, b) {
    return a.year === b.year && a.month === b.month && a.day === b.day &&
        a.hour === b.hour && a.minute === b.minute && a.second === b.second;
}
function coded(code, message) { const error = new Error(message); error.code = code; return error; }

module.exports = ScheduleOccurrenceResolver;
