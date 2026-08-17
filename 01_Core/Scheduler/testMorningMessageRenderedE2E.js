const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path");
const AutomationManager = require("../Automation_Manager/automationManager");
const SqliteAutomationStore = require("../Automation_Manager/sqliteAutomationStore");
const ScheduleOccurrenceResolver = require("../../02_Core/Time/scheduleOccurrenceResolver");
const AutomationSchedulerBridge = require("./automationSchedulerBridge");
const SchedulerRuntime = require("./schedulerRuntime");
const ScheduledEventPublicationRenderer = require("./scheduledEventPublicationRenderer");
const TaskEngine = require("../Task_Engine/02_taskEngine");
const PublishingAgentExecutor = require("../Task_Engine/05_publishingAgentExecutor");
const ScheduledTaskEngineAdapter = require("../Task_Engine/06_scheduledTaskEngineAdapter");
const EventEngine = require("../Event_Engine/03_eventEngine");
const RuleResolver = require("../Rule_Layer/03_ruleResolver");
const { createScheduledTaskRule } = require("./scheduledEventHandler");
const { createMarketSessionSchedules } = require("../../02_Core/Time/marketSessionSchedules");

(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swisschart-morning-e2e-"));
    const dbPath = path.join(dir, "schedule.sqlite");
    const clock = () => new Date("2026-08-17T06:00:30.000Z");
    const store = new SqliteAutomationStore({ databasePath: dbPath, clock });
    const manager = new AutomationManager({ automationStore: null, scheduleStore: store, clock });
    const schedule = createMarketSessionSchedules().find(item =>
        item.scheduleId === "market.london.preopen_60m"
    );
    schedule.enabled = true;
    const prepared = manager.prepareScheduleCreate(schedule);
    manager.approveScheduleMutation({
        approvalId: prepared.approvalId,
        payloadHash: prepared.payloadHash,
        confirm: true
    });

    const occurrenceResolver = new ScheduleOccurrenceResolver();
    const bridge = new AutomationSchedulerBridge({
        automationManager: manager,
        occurrenceStore: store,
        occurrenceResolver,
        clock
    });

    let publishedMessage = null;
    const taskEngine = new TaskEngine({
        scheduleAuthorizationStore: store,
        executors: {
            "publishing-agent": new PublishingAgentExecutor({ publisherFactory: () => ({
                async publishContent(message) {
                    publishedMessage = message;
                    return { message_id: 999, chat: { id: "test-chat" } };
                }
            }) })
        },
        clock
    });
    const eventEngine = new EventEngine({
        taskEngine: new ScheduledTaskEngineAdapter({ taskEngine }),
        rules: [createScheduledTaskRule()],
        ruleResolver: new RuleResolver(),
        clock
    });
    const publicationRenderer = new ScheduledEventPublicationRenderer({
        capabilityGateway: {
            async execute() {
                return {
                    status: "completed",
                    data: {
                        date: "2026-08-17",
                        timezone: "America/New_York",
                        highImpactEvents: [
                            { title: "Retail Sales", currency: "USD", scheduledAt: "2026-08-17T12:30:00.000Z" },
                            { title: "Consumer Sentiment", currency: "USD", scheduledAt: "2026-08-17T14:00:00.000Z" }
                        ],
                        bankHolidays: [
                            { title: "Bank Holiday", currency: "GBP", scheduledAt: "2026-08-17T04:00:00.000Z", isBankHoliday: true }
                        ]
                    }
                };
            }
        },
        logger: { warn() {} }
    });
    const runtime = new SchedulerRuntime({
        eventEngine,
        automationSchedulerBridge: bridge,
        scheduledEventPublicationRenderer: publicationRenderer,
        occurrenceStore: store,
        clock
    });

    await runtime.tick();
    assert(publishedMessage, "Morning Message must reach existing Publishing Agent path");
    assert(publishedMessage.includes("Good morning traders"));
    assert(publishedMessage.includes("08:30 — USD Retail Sales"));
    assert(publishedMessage.includes("10:00 — USD Consumer Sentiment"));
    assert(publishedMessage.includes("GBP — Bank Holiday"));
    assert(publishedMessage.includes("Stay focused and wait for clean setups"));
    assert(publishedMessage.endsWith('<a href="https://linktr.ee/swisschart">Swisschart Links</a>'));

    console.log("MORNING_MESSAGE_RENDERED_E2E=PASS");
    console.log("--- RENDERED OUTPUT ---");
    console.log(publishedMessage);
    console.log("--- END OUTPUT ---");

    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
})().catch(error => { console.error(error); process.exitCode = 1; });
