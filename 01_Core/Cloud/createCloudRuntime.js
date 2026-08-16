const { loadCloudConfig } = require("./cloudConfig");
const { createStructuredLogger } = require("./structuredLogger");
const { createCloudComposition } = require("./cloudComposition");
const { McpEdge } = require("./mcpEdge");
const { createHttpServer } = require("./httpServer");
const ProductionRuntime = require("./productionRuntime");
const OAuthBridge = require("./oauthBridge");
const OAuthStateStore = require("./oauthStateStore");
const SignalActionStore = require("./signalActionStore");
const SignalMutationCoordinator = require("./signalMutationCoordinator");
const TelegramPublishCoordinator = require("./telegramPublishCoordinator");

const PublishingAgent = require(
    "../../02_Agents/02_Publishing_Agent/publishingAgent"
);

const TaskEngine = require("../Task_Engine/02_taskEngine");
const PublishingAgentExecutor = require(
    "../Task_Engine/05_publishingAgentExecutor"
);
const ScheduledTaskEngineAdapter = require(
    "../Task_Engine/06_scheduledTaskEngineAdapter"
);

const EventEngine = require("../Event_Engine/03_eventEngine");
const RuleResolver = require("../Rule_Layer/03_ruleResolver");

const SchedulerRuntime = require("../Scheduler/schedulerRuntime");
const AutomationSchedulerBridge = require(
    "../Scheduler/automationSchedulerBridge"
);
const {
    createScheduledTaskRule
} = require("../Scheduler/scheduledEventHandler");

const ScheduleOccurrenceResolver = require(
    "../../02_Core/Time/scheduleOccurrenceResolver"
);

const path = require("path");

function createCloudRuntime(options = {}) {
    const environment = options.environment || process.env;
    const config = options.config || loadCloudConfig(environment);
    const logger = options.logger || createStructuredLogger();
    const publisher = options.publisher || new PublishingAgent();

    const composition = options.composition || createCloudComposition({
        enableSignalMutation: true,
        enableTelegramSignal: true,
        publisher,
        scheduleDatabasePath:
            options.scheduleDatabasePath || config.scheduleDatabaseFile
    });

    const oauthStateStore = options.oauthStateStore || new OAuthStateStore({
        filePath: config.oauthStateFile
    });

    const oauthBridge = options.oauthBridge || new OAuthBridge({
        issuer: config.publicBaseUrl,
        founderPassword: config.founderPassword,
        stateStore: oauthStateStore,
        logger
    });

    const signalStore = options.signalStore || new SignalActionStore({
        filePath: path.join(
            path.dirname(config.oauthStateFile),
            "signal-actions.json"
        )
    });

    const signalCoordinator = options.signalCoordinator ||
        new SignalMutationCoordinator({
            assistant: composition.assistant,
            store: signalStore
        });

    const telegramStore = options.telegramStore || new SignalActionStore({
        filePath: path.join(
            path.dirname(config.oauthStateFile),
            "telegram-actions.json"
        )
    });

    const telegramCoordinator = options.telegramCoordinator ||
        new TelegramPublishCoordinator({
            assistant: composition.assistant,
            store: telegramStore,
            destinationId: config.telegramChatId
        });

    const edge = options.edge || new McpEdge({
        assistant: composition.assistant,
        bearerToken: config.bearerToken,
        oauthTokenValidator: (token) =>
            oauthBridge.validateAccessToken(token),
        logger,
        signalCoordinator,
        telegramCoordinator
    });

    const server = options.server || createHttpServer({
        edge,
        oauthBridge,
        logger
    });

    const schedulerRuntime = options.schedulerRuntime ||
        createProductionSchedulerRuntime({
            composition,
            publisher,
            clock: options.clock
        });

    return new ProductionRuntime({
        server,
        port: config.port,
        logger,
        process: options.process,
        telegramRuntime: options.telegramRuntime,
        schedulerRuntime:
            config.schedulerEnabled === true
                ? schedulerRuntime
                : null
    });
}

function createProductionSchedulerRuntime(options = {}) {
    const composition = options.composition;

    if (
        !composition ||
        !composition.automationManager ||
        !composition.scheduleStore
    ) {
        return null;
    }

    const publishingExecutor = new PublishingAgentExecutor({
        publisherFactory: () => options.publisher
    });

    const taskEngine = new TaskEngine({
        scheduleAuthorizationStore: composition.scheduleStore,
        executors: {
            "publishing-agent": publishingExecutor
        },
        ...(options.clock ? { clock: options.clock } : {})
    });

    const scheduledTaskEngineAdapter = new ScheduledTaskEngineAdapter({
        taskEngine
    });

    const eventEngine = new EventEngine({
        taskEngine: scheduledTaskEngineAdapter,
        rules: [createScheduledTaskRule()],
        ruleResolver: new RuleResolver(),
        ...(options.clock ? { clock: options.clock } : {})
    });

    const occurrenceResolver = new ScheduleOccurrenceResolver();

    const automationSchedulerBridge = new AutomationSchedulerBridge({
        automationManager: composition.automationManager,
        occurrenceStore: composition.scheduleStore,
        occurrenceResolver,
        ...(options.clock ? { clock: options.clock } : {})
    });

    return new SchedulerRuntime({
        eventEngine,
        automationSchedulerBridge,
        occurrenceStore: composition.scheduleStore,
        ...(options.clock ? { clock: options.clock } : {})
    });
}

module.exports = {
    createCloudRuntime,
    createProductionSchedulerRuntime
};