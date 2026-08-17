const SwisschartAssistant = require("../Assistant/01_assistant");
const CapabilityRegistry = require("../../02_Core/Capabilities/capabilityRegistry");
const CapabilityGateway = require("../../02_Core/Capabilities/capabilityGateway");
const TradingDataCapability = require("../../02_Core/Capabilities/tradingDataCapability");
const TradingAnalyticsCapability = require(
    "../../02_Core/Capabilities/tradingAnalyticsCapability"
);
const GeneralTradingAnalysisCapability = require(
    "../../02_Core/Capabilities/generalTradingAnalysisCapability"
);
const NotionSignalCapability = require("../../02_Core/Capabilities/notionSignalCapability");
const TelegramSignalCapability = require("../../02_Core/Capabilities/telegramSignalCapability");
const ScheduleManagementCapability = require("../../02_Core/Capabilities/scheduleManagementCapability");
const MarketCalendarCapability = require("../../02_Core/Capabilities/marketCalendarCapability");
const AutomationManager = require("../Automation_Manager/automationManager");
const SqliteAutomationStore = require("../Automation_Manager/sqliteAutomationStore");

function createCloudComposition(options = {}) {
    const tradingDataCapability = options.tradingDataCapability ||
        new TradingDataCapability();
    let scheduleStore = null;
    let automationManager = null;
    let scheduleManagementCapability = options.scheduleManagementCapability || null;
    if (!scheduleManagementCapability && options.scheduleDatabasePath) {
        scheduleStore = new SqliteAutomationStore({
            databasePath: options.scheduleDatabasePath,
            clock: options.clock
        });
        automationManager = new AutomationManager({
            automationStore: null,
            scheduleStore,
            clock: options.clock
        });
        scheduleManagementCapability = new ScheduleManagementCapability({
            automationManager
        });
    }
    const capabilities = [
        tradingDataCapability,
        new TradingAnalyticsCapability({ tradingDataCapability }),
        new GeneralTradingAnalysisCapability({ tradingDataCapability }),
        ...(options.enableSignalMutation ? [options.notionSignalCapability || new NotionSignalCapability()] : []),
        ...(options.enableTelegramSignal ? [options.telegramSignalCapability || new TelegramSignalCapability({ publisher: options.publisher, tradingDataCapability })] : []),
        options.marketCalendarCapability || new MarketCalendarCapability(),
        ...(scheduleManagementCapability ? [scheduleManagementCapability] : [])
    ];
    const capabilityRegistry = options.capabilityRegistry ||
        new CapabilityRegistry(capabilities);
    const capabilityGateway = options.capabilityGateway ||
        new CapabilityGateway({ registry: capabilityRegistry });
    const disabled = disabledInterface();
    const assistant = options.assistant || new SwisschartAssistant({
        testMode: true,
        taskEngine: {},
        capabilityGateway,
        requestUnderstanding: {
            async understand() {
                throw cloudBoundaryError("Raw text understanding is disabled at the MCP edge");
            }
        },
        automationManager: disabledAutomationManager(),
        automationSchedulerBridge: { getScheduledEvents() { return []; } }
    });

    return { assistant, capabilityGateway, capabilityRegistry,
        scheduleManagementCapability, automationManager, scheduleStore,
        schedulerRuntime: null };
}

function disabledInterface() {
    return { async execute() { throw cloudBoundaryError(); } };
}

function disabledAutomationManager() {
    const reject = () => { throw cloudBoundaryError(); };
    return {
        createAutomation: reject,
        updateAutomation: reject,
        enableAutomation: reject,
        disableAutomation: reject,
        deleteAutomation: reject
    };
}

function cloudBoundaryError(message = "Operation is unavailable in read-only cloud runtime") {
    const error = new Error(message);
    error.code = "CLOUD_READ_ONLY_BOUNDARY";
    return error;
}

module.exports = { createCloudComposition };
