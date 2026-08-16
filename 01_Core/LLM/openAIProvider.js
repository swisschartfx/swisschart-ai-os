const {
    LLM_PROVIDER_CONTRACT_VERSION,
    validateProviderRequest,
    normalizeUsage,
    createProviderError
} = require("./llmProviderContract");

class OpenAIProvider {
    constructor(options = {}) {
        this.providerId = "openai";
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        this.model = options.model || process.env.OPENAI_MODEL;
        this.baseUrl = options.baseUrl || process.env.OPENAI_BASE_URL ||
            "https://api.openai.com/v1";
        this.fetch = options.fetch || globalThis.fetch;
    }

    async generateStructured(request) {
        const validation = validateProviderRequest(request);
        if (!validation.valid) {
            return failure("LLM_PROVIDER_REQUEST_INVALID", "validation_error",
                validation.errors.join("; "), false, this.providerId);
        }
        if (!this.apiKey || !this.model || typeof this.fetch !== "function") {
            return failure("LLM_PROVIDER_CONFIGURATION_MISSING", "configuration_error",
                "OpenAI provider requires OPENAI_API_KEY, OPENAI_MODEL and fetch", false,
                this.providerId);
        }

        try {
            const response = await this.fetch(`${this.baseUrl}/responses`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: this.model,
                    instructions: request.instructions,
                    input: request.input,
                    text: {
                        format: {
                            type: "json_schema",
                            name: request.schemaName || "structured_response",
                            strict: true,
                            schema: request.schema
                        }
                    },
                    store: false
                })
            });
            const body = await response.json();
            if (!response.ok) {
                return failure("LLM_PROVIDER_REQUEST_FAILED", "provider_error",
                    "OpenAI request failed", response.status === 429 || response.status >= 500,
                    this.providerId, body && body.error && body.error.code);
            }

            let structured;
            try {
                structured = JSON.parse(readOutputText(body));
            } catch (cause) {
                return failure("LLM_PROVIDER_OUTPUT_MALFORMED", "output_error",
                    "OpenAI structured output could not be parsed", false,
                    this.providerId, cause.name);
            }

            return {
                ok: true,
                contractVersion: LLM_PROVIDER_CONTRACT_VERSION,
                provider: this.providerId,
                model: body.model || this.model,
                data: structured,
                usage: normalizeUsage(body.usage),
                metadata: {
                    providerRequestId: body.id || null,
                    activity: request.activity,
                    status: body.status || null
                }
            };
        } catch (cause) {
            return failure("LLM_PROVIDER_UNAVAILABLE", "transport_error",
                "OpenAI provider is unavailable", true, this.providerId,
                cause && cause.code);
        }
    }
}

function readOutputText(body) {
    if (typeof body.output_text === "string") return body.output_text;
    for (const item of body.output || []) {
        for (const content of item.content || []) {
            if (content.type === "output_text" && typeof content.text === "string") {
                return content.text;
            }
        }
    }
    throw new Error("Output text is missing");
}

function failure(code, type, message, retryable, provider, reference) {
    return {
        ok: false,
        error: createProviderError(code, type, message, retryable, provider, reference)
    };
}

module.exports = OpenAIProvider;
