const assert = require("assert");

const OpenAIProvider = require("./openAIProvider");

async function run() {
    const calls = [];
    const provider = new OpenAIProvider({
        apiKey: "test-key",
        model: "test-model",
        fetch: async (url, options) => {
            calls.push({ url, options });
            return {
                ok: true,
                async json() {
                    return {
                        id: "resp-test-1",
                        model: "test-model-2026",
                        status: "completed",
                        output_text: JSON.stringify({ value: "structured" }),
                        usage: {
                            input_tokens: 20,
                            output_tokens: 10,
                            total_tokens: 30,
                            input_tokens_details: { cached_tokens: 5 }
                        }
                    };
                }
            };
        }
    });
    const result = await provider.generateStructured({
        activity: "assistant.request_understanding",
        input: "Founder request",
        instructions: "Normalize",
        schemaName: "test_schema",
        schema: {
            type: "object",
            additionalProperties: false,
            required: ["value"],
            properties: { value: { type: "string" } }
        }
    });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.data, { value: "structured" });
    assert.deepStrictEqual(result.usage, {
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
        cachedInputTokens: 5
    });
    assert.strictEqual(result.metadata.providerRequestId, "resp-test-1");
    assert.strictEqual(result.metadata.activity, "assistant.request_understanding");
    const body = JSON.parse(calls[0].options.body);
    assert.strictEqual(calls[0].url, "https://api.openai.com/v1/responses");
    assert.strictEqual(body.text.format.type, "json_schema");
    assert.strictEqual(body.text.format.strict, true);
    assert.strictEqual(body.store, false);

    const malformed = new OpenAIProvider({
        apiKey: "test-key",
        model: "test-model",
        fetch: async () => ({
            ok: true,
            async json() { return { output_text: "not json" }; }
        })
    });
    const malformedResult = await malformed.generateStructured({
        activity: "test", input: "test", schema: {}
    });
    assert.strictEqual(malformedResult.ok, false);
    assert.strictEqual(malformedResult.error.code, "LLM_PROVIDER_OUTPUT_MALFORMED");

    console.log("OpenAI Provider mock tests passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
