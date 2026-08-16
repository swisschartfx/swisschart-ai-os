const { validateUnderstanding } = require("./requestUnderstandingContract");

const nullableString = { type: ["string", "null"] };
const UNDERSTANDING_SCHEMA = {
    type: "object", additionalProperties: false,
    required: ["requestClass", "requiresCapability", "domain", "requestedMetric",
        "analyticalGoal", "period", "capabilityCandidate", "operationCandidate",
        "calculationRequired", "responseCandidate", "content", "confidence",
        "originalRequest"],
    properties: {
        requestClass: { type: "string", enum: ["conversation", "read", "analyze",
            "prepare", "action", "schedule"] },
        requiresCapability: { type: "boolean" },
        domain: nullableString, requestedMetric: nullableString,
        analyticalGoal: nullableString,
        period: { type: ["string", "null"], enum: ["current_month", "all_time",
            "unspecified", null] },
        capabilityCandidate: nullableString, operationCandidate: nullableString,
        calculationRequired: { type: ["boolean", "null"] },
        responseCandidate: nullableString, content: nullableString,
        confidence: { type: "number", minimum: 0, maximum: 1 },
        originalRequest: { type: "string" }
    }
};

class LLMRequestUnderstanding {
    constructor(options = {}) {
        this.provider = options.provider;
        this.capabilityRegistry = options.capabilityRegistry;
        this.fallback = options.fallback || null;
    }

    async understand(text) {
        if (!this.provider || typeof this.provider.generateStructured !== "function") {
            return this.useFallback(text);
        }
        const capabilityCatalog = createCapabilityCatalog(this.capabilityRegistry);
        const providerResult = await this.provider.generateStructured({
            activity: "assistant.request_understanding", input: String(text || ""),
            schemaName: "assistant_request_understanding", schema: UNDERSTANDING_SCHEMA,
            instructions: createInstructions(capabilityCatalog)
        });
        if (!providerResult.ok) return this.useFallback(text, providerResult.error);
        const validation = validateUnderstanding(providerResult.data);
        if (!validation.valid) return this.useFallback(text, {
            code: "REQUEST_UNDERSTANDING_INVALID",
            message: validation.errors.join("; ")
        });

        const understanding = compactUnderstanding(providerResult.data, validation);
        const requestClass = understanding.requestClass;
        const metricRoute = ["read", "analyze"].includes(requestClass)
            ? resolveMetricRoute(this.capabilityRegistry, understanding.requestedMetric)
            : null;
        const candidateAllowed = isCandidateAllowed(this.capabilityRegistry, understanding);
        const fixedAnalyticalRoute = requestClass === "analyze" && metricRoute &&
            metricRoute.capability !== "trading.data" ? metricRoute : null;
        const summaryRoute = metricRoute && metricRoute.capability === "trading.data" &&
            (candidateAllowed || understanding.calculationRequired === true)
            ? metricRoute : null;
        const periodSupported = understanding.period === "current_month";
        const conversation = requestClass === "conversation";
        const route = summaryRoute || fixedAnalyticalRoute ||
            (requestClass !== "analyze" &&
                !(understanding.calculationRequired === true && !metricRoute) &&
                candidateAllowed ? {
                capability: understanding.capabilityCandidate,
                operation: understanding.operationCandidate
            } : null);
        const hasRequiredInput = route && route.capability === "publishing.telegram"
            ? typeof understanding.content === "string" &&
                Boolean(understanding.content.trim()) : true;
        const executable = Boolean(!conversation && understanding.requiresCapability &&
            route && hasRequiredInput &&
            (!["read", "analyze"].includes(requestClass) || periodSupported));
        const generalAnalysisEligible = Boolean(["read", "analyze"].includes(
            requestClass) && understanding.domain === "trading" &&
            understanding.calculationRequired === true && !metricRoute);
        const unsupportedReason = conversation ? null
            : !understanding.requiresCapability ? `${requestClass}_capability_not_available`
                : !route ? requestClass === "analyze" &&
                    understanding.calculationRequired === true
                    ? "analytical_metric_not_supported"
                    : "capability_or_operation_not_registered"
                    : !hasRequiredInput ? "required_input_missing"
                    : !periodSupported && ["read", "analyze"].includes(requestClass)
                        ? "period_not_supported" : null;

        return {
            intent: conversation ? "conversation" : "llm_request_understanding",
            requestClass, requiresCapability: understanding.requiresCapability,
            understanding, requestedMetrics: understanding.requestedMetric,
            conversationalResponse: conversation ? understanding.responseCandidate : null,
            executable, unsupportedReason, generalAnalysisEligible,
            providerMetadata: metadata(providerResult),
            capabilityRequest: executable ? createExecutionRequest(understanding, route) : null
        };
    }

    async useFallback(text, llmError) {
        if (!this.fallback) return null;
        const result = await this.fallback.understand(text);
        if (result && llmError) result.llmError = llmError;
        return result;
    }
}

function resolveMetricRoute(registry, requestedMetric) {
    if (!registry || typeof registry.list !== "function" || !requestedMetric) return null;
    for (const capability of registry.list()) {
        const declaration = capability && capability.declaration;
        if (!declaration || !Array.isArray(capability.supportedMetrics) ||
            !capability.supportedMetrics.includes(requestedMetric)) continue;
        const operation = capability.metricOperations &&
            capability.metricOperations[requestedMetric] ||
            declaration.supportedOperations.length === 1 &&
            declaration.supportedOperations[0];
        if (operation) return { capability: declaration.capabilityId, operation };
    }
    return null;
}

function resolveFixedAnalyticalRoute(registry, requestedMetric) {
    const route = resolveMetricRoute(registry, requestedMetric);
    return route && route.capability !== "trading.data" ? route : null;
}

function isCandidateAllowed(registry, understanding) {
    if (!understanding.requiresCapability || !registry) return false;
    const capability = registry.get(understanding.capabilityCandidate);
    return Boolean(capability && capability.declaration &&
        capability.declaration.supportedOperations.includes(
            understanding.operationCandidate));
}

function createCapabilityCatalog(registry) {
    if (!registry || typeof registry.list !== "function") return [];
    return registry.list().flatMap((capability) => {
        const declaration = capability && capability.declaration;
        if (!declaration) return [];
        return [{ capabilityId: declaration.capabilityId, domain: declaration.domain,
            behavior: declaration.behavior,
            supportedOperations: [...declaration.supportedOperations],
            ...(Array.isArray(capability.supportedMetrics)
                ? { supportedMetrics: [...capability.supportedMetrics] } : {}) }];
    });
}

function createInstructions(catalog) {
    return "Classify the founder's Persian or English message semantically. " +
        "Use requestClass conversation for greetings, identity/help questions, and " +
        "ordinary discussion that needs no Swisschart data or side effect. For conversation " +
        "set requiresCapability false and provide a natural responseCandidate in the user's " +
        "language. You are the Swisschart Assistant. Never invent business data, claim an " +
        "action occurred, or treat conversation as analysis. Use read for factual Swisschart " +
        "data, analyze for calculations or interpretation, prepare for drafting content, " +
        "action for immediate side effects, and schedule for future or recurring work. " +
        "Only set requiresCapability true when an exact catalog capability and operation fit. " +
        "For unsupported prepare or schedule requests set it false. Select metrics and routes " +
        "only from the catalog. Put text to publish in content when explicitly supplied; do " +
        "not invent it. The LLM only interprets and never executes. Use null for irrelevant " +
        "fields. Registered capability catalog: " + JSON.stringify(catalog);
}

function compactUnderstanding(value, validation) {
    const result = { ...value, requestClass: validation.requestClass,
        requiresCapability: validation.requiresCapability };
    for (const key of Object.keys(result)) if (result[key] === null) delete result[key];
    return result;
}

function createExecutionRequest(understanding, route) {
    const { createCapabilityRequest } = require("../../02_Core/Capabilities/capabilityContract");
    let input;
    if (route.capability === "trading.analytics") input = {
        requestedMetric: understanding.requestedMetric,
        analyticalGoal: understanding.analyticalGoal,
        period: understanding.period, filters: { status: "closed" }
    };
    else if (route.capability === "trading.data") input = { period: understanding.period };
    else if (route.capability === "publishing.telegram") input = {
        message: understanding.content
    };
    else input = {};
    return createCapabilityRequest({ capability: route.capability,
        operation: route.operation, input, context: {},
        constraints: { readOnly: understanding.requestClass !== "action" },
        metadata: { requestedMetrics: understanding.requestedMetric,
            requestClass: understanding.requestClass, source: "llm" },
        requestedBy: "founder", source: "assistant-llm-understanding",
        inputContractVersion: "1.0" });
}

function metadata(result) {
    return { provider: result.provider, model: result.model, usage: result.usage,
        request: result.metadata };
}

module.exports = LLMRequestUnderstanding;
module.exports.UNDERSTANDING_SCHEMA = UNDERSTANDING_SCHEMA;
module.exports.createCapabilityCatalog = createCapabilityCatalog;
module.exports.resolveFixedAnalyticalRoute = resolveFixedAnalyticalRoute;
module.exports.resolveMetricRoute = resolveMetricRoute;
