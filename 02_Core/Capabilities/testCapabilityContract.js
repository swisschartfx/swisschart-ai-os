const assert = require("assert");

const {
    CAPABILITY_CONTRACT_VERSION,
    EXECUTION_MODES,
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    LIFECYCLE_STAGES,
    RESULT_STATUSES,
    createCapabilityDeclaration,
    validateCapabilityDeclaration,
    createCapabilityRequest,
    validateCapabilityRequest,
    createCapabilityResult,
    validateCapabilityResult,
    createCapabilityError
} = require("./capabilityContract");

function run() {
    const declaration = createCapabilityDeclaration({
        capabilityId: "trading.performance",
        domain: "trading",
        version: "1.0.0",
        supportedOperations: ["summarize"],
        executionMode: EXECUTION_MODES.SYNCHRONOUS,
        behavior: CAPABILITY_BEHAVIORS.READ_ONLY,
        approvalRequirement: APPROVAL_REQUIREMENTS.NONE,
        lifecycleSupport: [LIFECYCLE_STAGES.COLLECT, LIFECYCLE_STAGES.ANALYZE],
        inputContractVersion: "1.0",
        outputContractVersion: "1.0"
    });
    assert.strictEqual(validateCapabilityDeclaration(declaration).valid, true);
    assert.strictEqual(declaration.contractVersion, CAPABILITY_CONTRACT_VERSION);
    assert.strictEqual(Object.hasOwn(declaration, "databaseId"), false);

    assert.throws(() => createCapabilityDeclaration({}), (error) =>
        error.code === "CAPABILITY_DECLARATION_INVALID");

    const invalidMode = { ...declaration, executionMode: "background" };
    assert.strictEqual(validateCapabilityDeclaration(invalidMode).valid, false);
    assert(validateCapabilityDeclaration(invalidMode).errors.some((item) =>
        item.code === "CAPABILITY_EXECUTION_MODE_INVALID"));

    const invalidLifecycle = { ...declaration, lifecycleSupport: ["publish"] };
    assert.strictEqual(validateCapabilityDeclaration(invalidLifecycle).valid, false);
    assert(validateCapabilityDeclaration(invalidLifecycle).errors.some((item) =>
        item.code === "CAPABILITY_LIFECYCLE_INVALID"));

    const request = createCapabilityRequest({
        capability: declaration.capabilityId,
        operation: "summarize",
        input: { period: "month" },
        context: { timezone: "Europe/Istanbul" },
        constraints: { readOnly: true },
        metadata: { correlationId: "correlation-1" },
        requestedBy: "founder",
        source: "assistant",
        inputContractVersion: declaration.inputContractVersion
    }, {
        idGenerator: () => "request-1",
        clock: () => new Date("2026-08-13T10:00:00.000Z")
    });
    assert.strictEqual(validateCapabilityRequest(request).valid, true);
    assert.strictEqual(request.inputContractVersion, declaration.inputContractVersion);
    assert.strictEqual(Object.hasOwn(request, "notionDatabaseId"), false);
    assert.strictEqual(Object.hasOwn(request, "databaseId"), false);

    assert.strictEqual(validateCapabilityRequest({ operation: "summarize" }).valid, false);
    assert.throws(() => createCapabilityRequest({ operation: "summarize" }), (error) =>
        error.code === "CAPABILITY_REQUEST_INVALID");

    const result = createCapabilityResult({
        requestId: request.requestId,
        capability: request.capability,
        operation: request.operation,
        status: RESULT_STATUSES.COMPLETED,
        data: { winRate: 0.6 },
        summary: "Performance summarized",
        evidence: ["calculation-1"],
        sourceReferences: ["trading-journal"],
        recordCount: 10,
        timestamps: {
            startedAt: "2026-08-13T10:00:00.000Z",
            completedAt: "2026-08-13T10:00:01.000Z"
        },
        executionMetadata: { durationMs: 1000 },
        outputContractVersion: declaration.outputContractVersion
    });
    assert.strictEqual(validateCapabilityResult(result).valid, true);
    assert.strictEqual(result.outputContractVersion, declaration.outputContractVersion);
    assert.strictEqual(result.recordCount, 10);

    const normalizedError = createCapabilityError({
        code: "CAPABILITY_SOURCE_UNAVAILABLE",
        type: "dependency_unavailable",
        message: "Trading records are temporarily unavailable",
        retryable: true,
        sourceCapability: request.capability,
        sourceOperation: request.operation,
        internalCauseReference: "internal-error-42",
        cause: new Error("Raw Axios failure"),
        response: { provider: "notion" }
    });
    assert.deepStrictEqual(Object.keys(normalizedError), [
        "contractVersion",
        "code",
        "type",
        "message",
        "retryable",
        "sourceCapability",
        "sourceOperation",
        "internalCauseReference"
    ]);
    assert.strictEqual(Object.hasOwn(normalizedError, "cause"), false);
    assert.strictEqual(Object.hasOwn(normalizedError, "response"), false);

    console.log("Capability Contract test passed");
}

try {
    run();
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
