const { requireManualExternalAuthorization } = require("./manualExternalGuard");
const SqliteAutomationStore = require(
    "../../01_Core/Automation_Manager/sqliteAutomationStore"
);
const AutomationManager = require(
    "../../01_Core/Automation_Manager/automationManager"
);
const {
    createMarketSessionSchedules
} = require("../../02_Core/Time/marketSessionSchedules");

requireManualExternalAuthorization({
    actionFlags: ["SWISSCHART_ALLOW_SCHEDULE_SEED"],
    description: "Seed approved market-session schedules into production"
});

const databasePath =
    process.env.SWISSCHART_SCHEDULE_DATABASE_FILE || "/data/schedules.sqlite";

const store = new SqliteAutomationStore({ databasePath });
const manager = new AutomationManager({
    automationStore: null,
    scheduleStore: store
});

try {
    const schedules = createMarketSessionSchedules();

    for (const schedule of schedules) {
        if (schedule.enabled !== false) {
            throw new Error(
                `Refusing to seed enabled schedule: ${schedule.scheduleId}`
            );
        }

        const existing = manager
            .listSchedules()
            .find(item => item.scheduleId === schedule.scheduleId);

        if (existing) {
            console.log(`SKIP existing: ${schedule.scheduleId}`);
            continue;
        }

        const prepared = manager.prepareScheduleCreate(schedule);

        const result = manager.approveScheduleMutation({
            approvalId: prepared.approvalId,
            payloadHash: prepared.payloadHash,
            confirm: true
        });

        console.log(
            `CREATED: ${result.schedule.scheduleId} enabled=${result.schedule.enabled}`
        );
    }

    const finalSchedules = manager.listSchedules();

    console.log(`TOTAL=${finalSchedules.length}`);

    for (const schedule of finalSchedules) {
        console.log(
            `${schedule.scheduleId} enabled=${schedule.enabled} revision=${schedule.revision}`
        );
    }
} finally {
    store.close();
}