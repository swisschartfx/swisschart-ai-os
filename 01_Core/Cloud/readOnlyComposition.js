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

function createReadOnlyComposition(options = {}) {
    const tradingDataCapability = options.tradingDataCapability ||
        new TradingDataCapability();
    const capabilities = [
        tradingDataCapability,
        new TradingAnalyticsCapability({ tradingDataCapability }),
        new GeneralTradingAnalysisCapability({ tradingDataCapability }),
        ...(options.enableSignalMutation ? [options.notionSignalCapability || new NotionSignalCapability()] : []),
        ...(options.enableTelegramSignal ? [options.telegramSignalCapability || new TelegramSignalCapability({ publisher: options.publisher })] : []),
        ...(options.scheduleManagementCapability ? [options.scheduleManagementCapability] : [])
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
        notionAgent: { async handleRequest() { throw cloudBoundaryError(); } },
        telegramPublishingWorkflow: disabled,
        performanceSummaryTelegramWorkflow: disabled,
        automationManager: disabledAutomationManager(),
        automationSchedulerBridge: { getScheduledEvents() { return []; } }
    });

    return { assistant, capabilityGateway, capabilityRegistry };
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

module.exports = { createReadOnlyComposition };
