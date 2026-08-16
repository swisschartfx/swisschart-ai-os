class Scheduler {

    constructor() {

        this.jobs =
            new Map();

        console.log(
            "⏱️ Scheduler initialized"
        );
    }


    addJob(
        name,
        executeAt,
        task
    ) {

        if (!name) {

            throw new Error(
                "Job name is required"
            );
        }

        if (!(executeAt instanceof Date)) {

            throw new Error(
                "executeAt must be a Date"
            );
        }

        if (typeof task !== "function") {

            throw new Error(
                "Task must be a function"
            );
        }

        if (
            executeAt.getTime()
            <= Date.now()
        ) {

            throw new Error(
                "Job execution time must be in the future"
            );
        }

        const delay =
            executeAt.getTime()
            - Date.now();


        const timer =
            setTimeout(
                async () => {

                    try {

                        await task();

                    } catch (error) {

                        console.error(
                            `❌ Scheduler job failed: ${name}`
                        );

                        console.error(
                            error
                        );

                    } finally {

                        this.jobs.delete(
                            name
                        );

                    }

                },
                delay
            );


        this.jobs.set(
            name,
            {
                name,
                executeAt,
                timer,
                recurring: false
            }
        );


        console.log(
            `📅 Job scheduled: ${name}`
        );


        return name;
    }


    addDailyJob(
        name,
        time,
        timezone,
        task
    ) {

        if (!name) {

            throw new Error(
                "Job name is required"
            );
        }


        if (!time) {

            throw new Error(
                "Daily job time is required"
            );
        }


        if (!timezone) {

            throw new Error(
                "Timezone is required"
            );
        }


        if (typeof task !== "function") {

            throw new Error(
                "Task must be a function"
            );
        }


        const [hour, minute] =
            time.split(":")
                .map(Number);


        if (
            !Number.isInteger(hour) ||
            !Number.isInteger(minute) ||
            hour < 0 ||
            hour > 23 ||
            minute < 0 ||
            minute > 59
        ) {

            throw new Error(
                "Daily job time must use HH:MM format"
            );
        }


        if (
            this.jobs.has(name)
        ) {

            this.cancelJob(name);
        }


        const scheduleNext =
            () => {

                const executeAt =
                    this.getNextExecutionTime(
                        hour,
                        minute,
                        timezone
                    );


                const delay =
                    executeAt.getTime()
                    - Date.now();


                const timer =
                    setTimeout(
                        async () => {

                            try {

                                await task();

                            } catch (error) {

                                console.error(
                                    `❌ Scheduler job failed: ${name}`
                                );

                                console.error(
                                    error
                                );

                            } finally {

                                this.jobs.delete(
                                    name
                                );

                                scheduleNext();

                            }

                        },
                        delay
                    );


                this.jobs.set(
                    name,
                    {
                        name,
                        executeAt,
                        timer,
                        recurring: true,
                        time,
                        timezone
                    }
                );


                console.log(
                    `📅 Daily job scheduled: ${name} → ${time} (${timezone})`
                );

            };


        scheduleNext();


        return name;
    }


    getNextExecutionTime(
        hour,
        minute,
        timezone
    ) {

        const now =
            new Date();


        const formatter =
            new Intl.DateTimeFormat(
                "en-US",
                {
                    timeZone: timezone,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false
                }
            );


        const parts =
            formatter.formatToParts(now);


        const values = {};


        for (const part of parts) {

            if (
                part.type !== "literal"
            ) {

                values[part.type] =
                    part.value;

            }

        }


        const localNowMinutes =
            Number(values.hour) * 60
            + Number(values.minute);


        const targetMinutes =
            hour * 60
            + minute;


        let targetDate =
            new Date(
                Date.UTC(
                    Number(values.year),
                    Number(values.month) - 1,
                    Number(values.day),
                    hour,
                    minute,
                    0
                )
            );


        if (
            localNowMinutes
            >= targetMinutes
        ) {

            targetDate =
                new Date(
                    targetDate.getTime()
                    + 24 * 60 * 60 * 1000
                );

        }


        return this.convertTimezoneDateToUTC(
            targetDate,
            timezone
        );
    }


    convertTimezoneDateToUTC(
        date,
        timezone
    ) {

        const formatter =
            new Intl.DateTimeFormat(
                "en-US",
                {
                    timeZone: timezone,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false
                }
            );


        const parts =
            formatter.formatToParts(date);


        const values = {};


        for (const part of parts) {

            if (
                part.type !== "literal"
            ) {

                values[part.type] =
                    part.value;

            }

        }


        const localAsUTC =
            Date.UTC(
                Number(values.year),
                Number(values.month) - 1,
                Number(values.day),
                Number(values.hour),
                Number(values.minute),
                Number(values.second)
            );


        const offset =
            localAsUTC
            - date.getTime();


        return new Date(
            date.getTime()
            - offset
        );
    }


    cancelJob(name) {

        const job =
            this.jobs.get(name);


        if (!job) {

            return false;
        }


        clearTimeout(
            job.timer
        );


        this.jobs.delete(
            name
        );


        console.log(
            `🛑 Job cancelled: ${name}`
        );


        return true;
    }


    getJobs() {

        return Array.from(
            this.jobs.values()
        ).map(
            job => ({
                name:
                    job.name,

                executeAt:
                    job.executeAt,

                recurring:
                    job.recurring,

                time:
                    job.time,

                timezone:
                    job.timezone
            })
        );
    }
}


module.exports =
    Scheduler;
