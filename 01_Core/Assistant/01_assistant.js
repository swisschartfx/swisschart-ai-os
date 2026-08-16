const createSignal =
    require("../../03_Workflows/signalWorkflow").createSignal;

const { randomUUID } =
    require("crypto");

const TaskEngine =
    require("../Task_Engine/02_taskEngine");

const RuleResolver =
    require("../Rule_Layer/03_ruleResolver");

const ruleBootstrap =
    require("../Rule_Layer/ruleBootstrap");

const NotionAgent =
    require("../../02_Agents/Notion_Agent/notionAgent");

const TelegramPublishingWorkflow =
    require("../../03_Workflows/telegramPublishingWorkflow");

const AutomationManager =
    require("../Automation_Manager/automationManager");

const AutomationSchedulerBridge =
    require("../Scheduler/automationSchedulerBridge");

const FounderCommandParser =
    require("./founderCommandParser");

const PerformanceFormatterCapability =
    require("../../02_Core/Capabilities/performanceFormatterCapability");

const NotionCapability =
    require("../../02_Core/Capabilities/notionCapability");

const TelegramFormatterCapability =
    require("../../02_Core/Capabilities/telegramFormatterCapability");

const PerformanceSummaryTelegramWorkflow =
    require("../../03_Workflows/performanceSummaryTelegramWorkflow");

const { createCapabilityRequest } =
    require("../../02_Core/Capabilities/capabilityContract");

const CurrentMonthPerformanceRequestUnderstanding =
    require("./currentMonthPerformanceRequestUnderstanding");


class SwisschartAssistant {


    constructor(options = {}) {

        this.testMode =
            options.testMode || false;

        this.taskEngine =
            options.taskEngine ||
            new TaskEngine();

        this.ruleResolver =
            options.ruleResolver ||
            new RuleResolver({
                ruleStore:
                    options.ruleStore ||
                    ruleBootstrap
            });

        this.capabilityGateway =
            options.capabilityGateway ||
            null;

        this.requestUnderstanding =
            options.requestUnderstanding ||
            new CurrentMonthPerformanceRequestUnderstanding();

        this.analysisPlanner = options.analysisPlanner || null;

        this.notionAgent =
            options.notionAgent ||
            new NotionAgent();

        this.publishingAgent =
            options.publishingAgent ||
            (options.telegramPublishingWorkflow
                ? null
                : new (require("../../02_Agents/02_Publishing_Agent/index02"))());

        this.telegramPublishingWorkflow =
            options.telegramPublishingWorkflow ||
            new TelegramPublishingWorkflow({
                telegramService: {
                    sendMessage: payload =>
                        this.publishingAgent.publishContent(payload.text)
                }
            });

        this.automationManager =
            options.automationManager ||
            new AutomationManager();

        this.automationSchedulerBridge =
            options.automationSchedulerBridge ||
            new AutomationSchedulerBridge({
                automationManager:
                    this.automationManager
            });

        this.founderCommandParser =
            options.founderCommandParser ||
            new FounderCommandParser();

        this.performanceFormatterCapability =
            options.performanceFormatterCapability ||
            new PerformanceFormatterCapability();

        this.performanceSummaryTelegramWorkflow =
            options.performanceSummaryTelegramWorkflow ||
            (typeof this.taskEngine.execute === "function"
                ? new PerformanceSummaryTelegramWorkflow({
                    notionCapability:
                        options.notionCapability ||
                        new NotionCapability(),
                    telegramFormatterCapability:
                        options.telegramFormatterCapability ||
                        new TelegramFormatterCapability(),
                    taskEngine:
                        this.taskEngine
                })
                : null);


        this.activeWorkflow =
            null;


        this.currentStep =
            null;


        this.signalData =
            {};
    }


    // ==============================
    // Main Message Handler
    // ==============================

    async handle(message, requestContext = {}) {

        if (
            message &&
            typeof message === "object"
        ) {

            return await this.routeRequest(
                message
            );
        }

        const parsedRequest =
            this.founderCommandParser.parse(
                message
            );

        if (parsedRequest) {
            return await this.routeRequest(
                parsedRequest
            );
        }

        const understoodRequest =
            await this.requestUnderstanding.understand(
                message
            );

        if (understoodRequest) {
            return await this.handleUnderstoodRequest(
                understoodRequest
            );
        }

        const input =
            String(message ?? "")
                .trim();

        const approvalMatch =
            input.match(/^approve task (\S+)$/i);

        if (approvalMatch) {

            if (!this.taskEngine.founderApprovalController ||
                typeof this.taskEngine.founderApprovalController.approve !==
                    "function" ||
                typeof this.taskEngine.resumeApprovedTask !== "function") {
                const error = new Error(
                    "Task approval resume is unavailable"
                );
                error.code = "APPROVAL_RESUME_UNAVAILABLE";
                throw error;
            }

            const taskId =
                approvalMatch[1];

            this.taskEngine.founderApprovalController.approve(
                taskId
            );

            const execution =
                await this.taskEngine.resumeApprovedTask(
                    taskId
                );

            return this.formatTaskResponse(
                execution
            );
        }

        if (
            !this.activeWorkflow &&
            (
                input.toLowerCase() === "performance_summary" ||
                input.toLowerCase() === "performance summary"
            )
        ) {

            return await this.routeRequest({
                type: "notion",
                action: "getPerformanceSummary"
            });
        }

        if (
            !this.activeWorkflow &&
            input.toLowerCase() === "publish performance summary"
        ) {

            return await this.performanceSummaryTelegramWorkflow.execute({
                source: "founder",
                sourceReference:
                    requestContext.sourceReference ||
                    `assistant-request-${randomUUID()}`
            });
        }

        // ==============================
        // Approved Telegram Publication
        // ==============================

        if (
            !this.activeWorkflow &&
            input.toLowerCase()
                .startsWith("publish telegram:")
        ) {

            return await this.handleTelegramPublication(
                input,
                requestContext
            );
        }


        // ==============================
        // Start Signal Workflow
        // ==============================

        if (
            !this.activeWorkflow &&
            input.toLowerCase() === "signal"
        ) {

            this.activeWorkflow =
                "signal";


            this.currentStep =
                "pair";


            this.signalData =
                {};


            return {

                success: true,

                workflow:
                    "signal",

                completed:
                    false,

                message:
                    "📊 Signal\n\nSymbol?"
            };
        }


        // ==============================
        // No Active Workflow
        // ==============================

        if (
            !this.activeWorkflow
        ) {

            return {

                success: true,

                workflow:
                    null,

                completed:
                    false,

                message:
                    "I’m ready. Send a command."
            };
        }


        // ==============================
        // Signal Workflow
        // ==============================

        if (
            this.activeWorkflow ===
            "signal"
        ) {

            return await this.handleSignalInput(
                input
            );
        }


        return {

            success: false,

            workflow:
                this.activeWorkflow,

            completed:
                false,

            message:
                "Unknown workflow"
        };
    }


    // ==============================
    // Structured Command Routing
    // ==============================

    async routeRequest(request) {

        if (
            request.type === "capability"
        ) {

            return await this.handleCapabilityRequest(
                request
            );
        }

        if (
            request.type === "performance_summary_publish"
        ) {

            return await this.performanceSummaryTelegramWorkflow.execute({
                source: request.source || "founder",
                sourceReference:
                    request.sourceReference ||
                    `assistant-request-${randomUUID()}`
            });
        }

        if (
            request.type === "notion"
        ) {

            const {
                type,
                ...notionRequest
            } = request;

            const notionResult = await this.notionAgent.handleRequest(
                notionRequest
            );

            return notionResult &&
                notionResult.type === "performance_summary"
                ? await this.routeRequest(notionResult)
                : notionResult;
        }


        if (
            request.type === "performance_summary"
        ) {

            return await this.performanceFormatterCapability.execute({
                summary: request.summary
            });
        }


        if (
            request.type === "telegram_publish"
        ) {

            return await this.telegramPublishingWorkflow.execute(
                request.task || request.payload || request
            );
        }


        if (
            request.type === "automation"
        ) {

            return this.handleAutomationRequest(
                request
            );
        }


        throw new Error(
            `Unsupported Assistant request type: ${request.type}`
        );
    }


    async handleCapabilityRequest(request) {

        if (!this.capabilityGateway ||
            typeof this.capabilityGateway.execute !== "function") {
            const error = new Error(
                "Assistant Capability Gateway is unavailable"
            );
            error.code = "ASSISTANT_CAPABILITY_GATEWAY_UNAVAILABLE";
            throw error;
        }

        return this.capabilityGateway.execute(
            createCapabilityRequest({
                requestId: request.requestId,
                capability: request.capability,
                operation: request.operation,
                input: request.input || {},
                context: request.context || {},
                constraints: request.constraints || {},
                metadata: request.metadata || {},
                requestedBy: request.requestedBy || "founder",
                source: request.source || "assistant-shell",
                timestamp: request.timestamp,
                inputContractVersion:
                    request.inputContractVersion || "1.0"
            })
        );
    }


    async handleUnderstoodRequest(understoodRequest) {

        if (understoodRequest.requestClass === "conversation") {
            return {
                success: true,
                intent: "conversation",
                completed: true,
                message: understoodRequest.conversationalResponse ||
                    "I’m the Swisschart Assistant. How can I help?",
                providerMetadata: understoodRequest.providerMetadata
            };
        }

        if (understoodRequest.executable === false) {
            if (isGeneralAnalysisCandidate(understoodRequest) &&
                this.analysisPlanner && typeof this.analysisPlanner.plan === "function") {
                return this.handleGeneralAnalysis(understoodRequest);
            }
            return {
                success: false,
                intent: understoodRequest.intent,
                requestClass: understoodRequest.requestClass,
                message: formatUnsupportedUnderstoodRequest(understoodRequest),
                understanding: understoodRequest.understanding,
                unsupportedReason: understoodRequest.unsupportedReason,
                providerMetadata: understoodRequest.providerMetadata
            };
        }

        if (!this.capabilityGateway ||
            typeof this.capabilityGateway.execute !== "function") {
            const error = new Error(
                "Assistant Capability Gateway is unavailable"
            );
            error.code = "ASSISTANT_CAPABILITY_GATEWAY_UNAVAILABLE";
            throw error;
        }

        const result = await this.capabilityGateway.execute(
            understoodRequest.capabilityRequest
        );

        if (result.status !== "completed") {
            return {
                success: false,
                intent: understoodRequest.intent,
                requestClass: understoodRequest.requestClass,
                message: result.message || result.summary ||
                    "The requested capability did not complete.",
                capabilityResult: result
            };
        }

        if (understoodRequest.requestClass === "action") {
            return {
                success: true,
                intent: understoodRequest.intent,
                requestClass: "action",
                message: result.summary || "The requested action completed.",
                capabilityResult: result,
                providerMetadata: understoodRequest.providerMetadata
            };
        }

        const data = result.data;
        if (data && data.result &&
            typeof data.result.metric === "string" &&
            Number.isFinite(data.result.value)) {
            return {
                success: true,
                intent: understoodRequest.intent,
                message: formatAnalyticalResult(data),
                capabilityResult: result,
                providerMetadata: understoodRequest.providerMetadata
            };
        }
        return {
            success: true,
            intent: understoodRequest.intent,
            message: formatCurrentMonthPerformance(
                data,
                understoodRequest.requestedMetrics
            ),
            capabilityResult: result
        };
    }

    async handleGeneralAnalysis(understoodRequest) {
        const planned = await this.analysisPlanner.plan(
            understoodRequest.understanding.originalRequest
        );
        if (!planned.ok) {
            return {
                success: false,
                intent: "general_trading_analysis",
                message: "I could not create a safe analysis plan for this request.",
                planningError: planned.error
            };
        }
        const result = await this.capabilityGateway.execute(createCapabilityRequest({
            capability: "trading.general_analysis",
            operation: "trading.general_analysis.execute",
            input: { plan: planned.plan },
            context: {},
            constraints: { readOnly: true },
            metadata: { source: "llm_analysis_planner" },
            requestedBy: "founder",
            source: "assistant-general-analysis",
            inputContractVersion: "1.0"
        }));
        if (result.status !== "completed") {
            return {
                success: false,
                intent: "general_trading_analysis",
                message: result.message || "Trading analysis is unavailable.",
                capabilityResult: result,
                providerMetadata: planned.providerMetadata
            };
        }
        if (result.data.status === "missing_data") {
            return {
                success: true,
                intent: "general_trading_analysis",
                message: formatMissingAnalysisData(result.data),
                capabilityResult: result,
                providerMetadata: planned.providerMetadata
            };
        }
        return {
            success: true,
            intent: "general_trading_analysis",
            message: formatGeneralAnalysisResult(result.data),
            capabilityResult: result,
            providerMetadata: planned.providerMetadata
        };
    }


    handleAutomationRequest(request) {

        switch (request.action) {
            case "create":
                return this.automationManager.createAutomation(
                    request.automation
                );
            case "update":
                return this.automationManager.updateAutomation(
                    request.automationId,
                    request.updates
                );
            case "enable":
                return this.automationManager.enableAutomation(
                    request.automationId
                );
            case "disable":
                return this.automationManager.disableAutomation(
                    request.automationId
                );
            case "delete":
                return this.automationManager.deleteAutomation(
                    request.automationId
                );
            case "get":
                return this.automationManager.getAutomation(
                    request.automationId
                );
            default:
                throw new Error(
                    `Unsupported automation action: ${request.action}`
                );
        }
    }


    // ==============================
    // Task Engine Publication Handoff
    // ==============================

    async handleTelegramPublication(input, requestContext) {

        const command =
            "publish telegram:";

        const message =
            input
                .slice(command.length)
                .trim();

        const sourceReference =
            requestContext.sourceReference ||
            `assistant-request-${randomUUID()}`;

        const founderApprovalVerified =
            requestContext.founderApprovalVerified === true;

        const taskRequest = {
            source: "founder",
            sourceReference,
            createdBy: "assistant-core",
            intent: "content.publish",
            objective:
                "Publish the provided text to the configured Swisschart Telegram channel.",
            capabilityRequirement: "publishing.publish",
            input: {
                message,
                destination: "telegram.primary",
                contentType: "text"
            },
            priority: "normal",
            approval: {
                required: true,
                status: founderApprovalVerified
                    ? "approved"
                    : "pending",
                reason:
                    "External Telegram publication requires explicit founder approval.",
                decisionBy: founderApprovalVerified
                    ? requestContext.founderId || "founder"
                    : null,
                decisionAt: founderApprovalVerified
                    ? requestContext.approvalRecordedAt ||
                        new Date().toISOString()
                    : null,
                decisionReference: founderApprovalVerified
                    ? requestContext.approvalReference || sourceReference
                    : null
            },
            idempotencyKey:
                requestContext.idempotencyKey ||
                `telegram-publication-${sourceReference}`
        };

        const execution =
            await this.taskEngine.execute(
                taskRequest
            );

        return this.formatTaskResponse(
            execution
        );
    }


    formatTaskResponse(execution) {

        const task = execution.task;
        const result = execution.result;

        if (
            task.status ===
            "awaiting_approval"
        ) {

            return {
                success: true,
                workflow: null,
                completed: false,
                taskId: task.taskId,
                taskStatus: task.status,
                message:
                    "Telegram publication is awaiting explicit founder approval."
            };
        }

        if (
            task.status ===
            "completed"
        ) {

            const telegramReference =
                result.externalReferences
                    .find(reference =>
                        reference.platform ===
                        "telegram"
                    );

            return {
                success: true,
                workflow: null,
                completed: true,
                taskId: task.taskId,
                taskStatus: task.status,
                message:
                    telegramReference &&
                    telegramReference.messageId
                        ? `Telegram publication completed. Message ID: ${telegramReference.messageId}`
                        : result.summary
            };
        }

        return {
            success: false,
            workflow: null,
            completed: true,
            taskId: task.taskId,
            taskStatus: task.status,
            message:
                result
                    ? result.summary
                    : "Task execution did not return a verified result."
        };
    }


    // ==============================
    // Signal Input Handler
    // ==============================

    async handleSignalInput(input) {


        switch (
            this.currentStep
        ) {


            // ==============================
            // Symbol
            // ==============================

            case "pair":

                if (!input) {

                    return {

                        success: false,

                        workflow:
                            "signal",

                        completed:
                            false,

                        message:
                            "Symbol cannot be empty"
                    };
                }


                this.signalData.pair =
                    input.toUpperCase();


                this.currentStep =
                    "direction";


                return {

                    success: true,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "Direction? BUY or SELL"
                };


            // ==============================
            // Direction
            // ==============================

            case "direction":

                {

                    const direction =
                        input.toUpperCase();


                    if (
                        direction !== "BUY" &&
                        direction !== "SELL"
                    ) {

                        return {

                            success: false,

                            workflow:
                                "signal",

                            completed:
                                false,

                            message:
                                "Please enter BUY or SELL"
                        };
                    }


                    this.signalData.direction =
                        direction;


                    this.currentStep =
                        "entry";


                    return {

                        success: true,

                        workflow:
                            "signal",

                        completed:
                            false,

                        message:
                            "Entry?"
                    };
                }


            // ==============================
            // Entry
            // ==============================

            case "entry":

                if (
                    !this.isValidNumber(input)
                ) {

                    return {

                        success: false,

                        workflow:
                            "signal",

                        completed:
                            false,

                        message:
                            "Please enter a valid Entry price"
                    };
                }


                this.signalData.entry =
                    Number(input);


                this.currentStep =
                    "stopLoss";


                return {

                    success: true,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "Stop Loss?"
                };


            // ==============================
            // Stop Loss
            // ==============================

            case "stopLoss":

                if (
                    !this.isValidNumber(input)
                ) {

                    return {

                        success: false,

                        workflow:
                            "signal",

                        completed:
                            false,

                        message:
                            "Please enter a valid Stop Loss"
                    };
                }


                this.signalData.stopLoss =
                    Number(input);


                this.currentStep =
                    "tp1";


                return {

                    success: true,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "TP1?"
                };


            // ==============================
            // TP1
            // ==============================

            case "tp1":

                if (
                    !this.isValidNumber(input)
                ) {

                    return {

                        success: false,

                        workflow:
                            "signal",

                        completed:
                            false,

                        message:
                            "Please enter a valid TP1"
                    };
                }


                this.signalData.tp1 =
                    Number(input);


                this.currentStep =
                    "tp2";


                return {

                    success: true,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "TP2?"
                };


            // ==============================
            // TP2
            // ==============================

            case "tp2":

                if (
                    !this.isValidNumber(input)
                ) {

                    return {

                        success: false,

                        workflow:
                            "signal",

                        completed:
                            false,

                        message:
                            "Please enter a valid TP2"
                    };
                }


                this.signalData.tp2 =
                    Number(input);


                this.currentStep =
                    "tp3";


                return {

                    success: true,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "TP3?"
                };


            // ==============================
            // TP3
            // ==============================

            case "tp3":

                if (
                    !this.isValidNumber(input)
                ) {

                    return {

                        success: false,

                        workflow:
                            "signal",

                        completed:
                            false,

                        message:
                            "Please enter a valid TP3"
                    };
                }


                this.signalData.tp3 =
                    Number(input);


                this.currentStep =
                    "risk";


                return {

                    success: true,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "Risk %?"
                };


            // ==============================
            // Risk
            // ==============================

            case "risk":

                if (!input) {

                    return {

                        success: false,

                        workflow:
                            "signal",

                        completed:
                            false,

                        message:
                            "Risk cannot be empty"
                    };
                }


                this.signalData.risk =
                    input;


                this.currentStep =
                    "grade";


                return {

                    success: true,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "Grade?"
                };


            // ==============================
            // Grade
            // ==============================

            case "grade":

                if (!input) {

                    return {

                        success: false,

                        workflow:
                            "signal",

                        completed:
                            false,

                        message:
                            "Grade cannot be empty"
                    };
                }


                this.signalData.grade =
                    input;


                this.currentStep =
                    "signalScreenshot";


                return {

                    success: true,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "Signal screenshot? Optional — send none if unavailable"
                };


            // ==============================
            // Signal Screenshot
            // ==============================

            case "signalScreenshot":

                if (
                    input.toLowerCase() !==
                    "none"
                ) {

                    this.signalData.signalScreenshot =
                        input;

                } else {

                    this.signalData.signalScreenshot =
                        null;
                }


                this.currentStep =
                    "tradingViewLink";


                return {

                    success: true,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "TradingView link? Optional — send none if unavailable"
                };


            // ==============================
            // TradingView Link
            // ==============================

            case "tradingViewLink":

                if (
                    input.toLowerCase() !==
                    "none"
                ) {

                    this.signalData.tradingViewLink =
                        input;

                } else {

                    this.signalData.tradingViewLink =
                        null;
                }


                return await this.finishSignal();


            default:

                return {

                    success: false,

                    workflow:
                        "signal",

                    completed:
                        false,

                    message:
                        "Unknown Signal step"
                };
        }
    }


    // ==============================
    // Finish Signal
    // ==============================

    async finishSignal() {

        console.log(
            "📦 Signal data collected:"
        );


        console.log(
            this.signalData
        );


        // ==============================
        // Publish Date + Signal Time NY
        // ==============================

        const now =
            new Date();


        this.signalData.publishDate =
            now.toISOString()
                .split("T")[0];


        this.signalData.signalTimeNY =
            now.toLocaleTimeString(
                "en-US",
                {
                    timeZone:
                        "America/New_York",

                    hour:
                        "2-digit",

                    minute:
                        "2-digit"
                }
            );


        console.log(
            "📅 Publish Date:",
            this.signalData.publishDate
        );


        console.log(
            "🕒 Signal Time NY:",
            this.signalData.signalTimeNY
        );


        // ==============================
        // TEST MODE
        // ==============================

        if (
            this.testMode
        ) {

            const signal =
                createSignal(
                    this.signalData
                );


            this.activeWorkflow =
                null;


            this.signalData =
                {};


            this.currentStep =
                null;


            return {

                success:
                    true,

                workflow:
                    "signal",

                completed:
                    true,

                testMode:
                    true,

                signal,

                message:
                    "🧪 Signal collected successfully"
            };
        }


        // ==============================
        // REAL EXECUTION
        // ==============================

        const signal =
            await require("../../03_Workflows/signalExecution")(
                this.signalData
            );


        this.activeWorkflow =
            null;


        this.signalData =
            {};


        this.currentStep =
            null;


        return {

            success:
                true,

            workflow:
                "signal",

            completed:
                true,

            signal,

            message:
                `✅ ${signal.tradeId} created and published`
        };
    }


    // ==============================
    // Number Validation
    // ==============================

    isValidNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return false;
        }


        const number =
            Number(value);


        return Number.isFinite(
            number
        );
    }
}


module.exports =
    SwisschartAssistant;

function formatCurrentMonthPerformance(data, requestedMetrics) {
    const totalTrades = Number(data.totalTrades);
    const wins = Number(data.wins);
    const losses = Number(data.losses);
    const winRate = Number(data.winRate);
    const netRR = Number(data.netRR);
    const percentage = Number.isFinite(winRate)
        ? Number((winRate * 100).toFixed(2))
        : 0;

    if (requestedMetrics === "trade_count") {
        return `This month: ${totalTrades} trade${totalTrades === 1 ? "" : "s"}.`;
    }
    if (requestedMetrics === "wins_losses") {
        return `This month: ${wins} win${wins === 1 ? "" : "s"} and ` +
            `${losses} loss${losses === 1 ? "" : "es"}.`;
    }
    if (requestedMetrics === "net_rr") {
        return `This month: net RR ${netRR}.`;
    }
    if (requestedMetrics === "win_rate") {
        return `This month: win rate ${percentage}% (${wins} ` +
            `win${wins === 1 ? "" : "s"}, ${losses} ` +
            `loss${losses === 1 ? "" : "es"}).`;
    }

    return `This month: ${totalTrades} trade${totalTrades === 1 ? "" : "s"}, ` +
        `win rate ${percentage}% (${wins} win${wins === 1 ? "" : "s"}, ` +
        `${losses} loss${losses === 1 ? "" : "es"}), net RR ${netRR}.`;
}

function formatAnalyticalResult(data) {
    const label = data.result.metric
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    const period = data.period === "current_month" ? "this month" : data.period;
    return `${label} ${period}: ${data.result.value}.`;
}

function isGeneralAnalysisCandidate(understoodRequest) {
    return Boolean(understoodRequest &&
        understoodRequest.generalAnalysisEligible === true);
}

function formatGeneralAnalysisResult(data) {
    return `${data.analysisGoal} (${data.period}): ${data.result}.`;
}

function formatMissingAnalysisData(data) {
    const missing = data.missingFields.map((item) =>
        `${item.field}: ${item.reason} Add ${item.suggestedData}.`).join(" ");
    return `${data.analysisGoal} cannot be calculated exactly. Missing data: ${missing}`;
}

function formatUnsupportedUnderstoodRequest(request) {
    const labels = {
        prepare: "I understood the content-preparation request, but no registered content capability can execute it yet.",
        action: "I understood the action request, but no registered capability can safely execute it.",
        schedule: "I understood the scheduling request, but this natural-language schedule cannot be executed by the current capabilities.",
        read: "I understood the data request, but the required data route is not supported by the current capabilities.",
        analyze: "I understood the analytical request, but the required metric is not supported by the current capabilities."
    };
    return labels[request.requestClass] ||
        "I understood the request, but it is not executable with the current capabilities.";
}
