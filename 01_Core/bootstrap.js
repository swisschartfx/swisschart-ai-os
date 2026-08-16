const SwisschartAssistant = require("./Assistant/01_assistant");
const RuleResolver = require("./Rule_Layer/03_ruleResolver");
const ruleStore = require("./Rule_Layer/ruleBootstrap");
const ScheduledTaskEngineAdapter = require(
    "./Task_Engine/06_scheduledTaskEngineAdapter"
);
const EventEngine = require("./Event_Engine/03_eventEngine");
const SchedulerRuntime = require("./Scheduler/schedulerRuntime");
const {
    createScheduledTaskRule
} = require("./Scheduler/scheduledEventHandler");
const TaskEngine = require("./Task_Engine/02_taskEngine");
const CapabilityRegistry = require("../02_Core/Capabilities/capabilityRegistry");
const CapabilityGateway = require("../02_Core/Capabilities/capabilityGateway");
const TradingDataCapability = require("../02_Core/Capabilities/tradingDataCapability");
const TelegramPublishingCapability = require(
    "../02_Core/Capabilities/telegramPublishingCapability"
);
const BrandIdentityCapability = require(
    "../02_Core/Capabilities/brandIdentityCapability"
);
const TradingAnalyticsCapability = require(
    "../02_Core/Capabilities/tradingAnalyticsCapability"
);
const OpenAIProvider = require("./LLM/openAIProvider");
const LLMRequestUnderstanding = require("./Assistant/llmRequestUnderstanding");
const CurrentMonthPerformanceRequestUnderstanding = require(
    "./Assistant/currentMonthPerformanceRequestUnderstanding"
);
const LLMAnalysisPlanner = require("./Assistant/llmAnalysisPlanner");
const GeneralTradingAnalysisCapability = require(
    "../02_Core/Capabilities/generalTradingAnalysisCapability"
);

const ruleResolver = new RuleResolver({
    ruleStore
});
const taskEngine = new TaskEngine();
const tradingDataCapability = new TradingDataCapability();
const generalTradingAnalysisCapability = new GeneralTradingAnalysisCapability({
    tradingDataCapability
});
const capabilityRegistry = new CapabilityRegistry([
    tradingDataCapability,
    new TradingAnalyticsCapability({ tradingDataCapability }),
    generalTradingAnalysisCapability,
    new TelegramPublishingCapability({
        taskEngine,
        ruleResolver
    }),
    new BrandIdentityCapability()
]);
const capabilityGateway = new CapabilityGateway({
    registry: capabilityRegistry
});
const openAIProvider = new OpenAIProvider();
const requestUnderstanding = new LLMRequestUnderstanding({
    provider: openAIProvider,
    capabilityRegistry,
    fallback: new CurrentMonthPerformanceRequestUnderstanding()
});
const analysisPlanner = new LLMAnalysisPlanner({
    provider: openAIProvider,
    tradingDataCapability
});
const assistant = new SwisschartAssistant({
    taskEngine,
    ruleResolver,
    capabilityGateway,
    requestUnderstanding,
    analysisPlanner
});
const scheduledTaskEngineAdapter = new ScheduledTaskEngineAdapter({
    taskEngine: assistant.taskEngine
});
const eventEngine = new EventEngine({
    taskEngine: scheduledTaskEngineAdapter,
    rules: [createScheduledTaskRule()],
    ruleResolver
});
const schedulerRuntime = new SchedulerRuntime({
    eventEngine,
    automationSchedulerBridge:
        assistant.automationSchedulerBridge
});

module.exports = {
    assistant,
    schedulerRuntime,
    eventEngine,
    ruleResolver,
    capabilityGateway,
    capabilityRegistry
};
