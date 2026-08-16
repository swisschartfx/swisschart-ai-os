const assert = require("assert");

const CapabilityRegistry = require("./capabilityRegistry");
const CapabilityGateway = require("./capabilityGateway");
const {
    EXECUTION_MODES,
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    LIFECYCLE_STAGES,
    createCapabilityDeclaration,
    createCapabilityRequest
} = require("./capabilityContract");

function declaration(capabilityId, behavior, operations = ["read"]) {
    return createCapabilityDeclaration({
        capabilityId,
        domain: "test",
        version: "1.0.0",
        supportedOperations: operations,
        executionMode: EXECUTION_MODES.SYNCHRONOUS,
        behavior,
        approvalRequirement: behavior === CAPABILITY_BEHAVIORS.MUTATING
            ? APPROVAL_REQUIREMENTS.REQUIRED
            : APPROVAL_REQUIREMENTS.NONE,
        lifecycleSupport: behavior === CAPABILITY_BEHAVIORS.MUTATING
            ? [LIFECYCLE_STAGES.ACT]
            : [LIFECYCLE_STAGES.COLLECT],
        inputContractVersion: "1.0",
        outputContractVersion: "1.1",
        ...(behavior === CAPABILITY_BEHAVIORS.MUTATING ? {
            operationPolicies: Object.fromEntries(operations.map(operation => [
                operation, { access: "mutation", mutationPolicy: {
                    approvalRequired: true,
                    payloadBindingRequired: true,
                    idempotencyRequired: true
                } }
            ]))
        } : {})
    });
}

function request(capability, operation, authority = {}) {
    return createCapabilityRequest({
        requestId: `request-${capability}-${operation}`,
        capability,
        operation,
        input: { value: 1 },
        context: authority.context || {},
        constraints: authority.constraints || {},
        metadata: {},
        requestedBy: "gateway-test",
        source: "unit-test",
        timestamp: "2026-08-13T12:00:00.000Z",
        inputContractVersion: "1.0"
    });
}

async function run() {
    const registry = new CapabilityRegistry();
    let readExecutionContext;
    let mutationExecutionContext;

    registry.register({
        name: "test.reader",
        declaration: declaration("test.reader", CAPABILITY_BEHAVIORS.READ_ONLY),
        async execute(capabilityRequest, executionContext) {
            readExecutionContext = executionContext;
            assert.strictEqual(capabilityRequest.input.value, 1);
            return {
                data: { records: [1, 2] },
                summary: "Records read",
                evidence: ["evidence-1"],
                sourceReferences: ["logical-source"],
                recordCount: 2,
                executionMetadata: { adapter: "test-adapter" }
            };
        }
    });

    registry.register({
        name: "test.writer",
        declaration: declaration("test.writer", CAPABILITY_BEHAVIORS.MUTATING, ["write"]),
        execute(capabilityRequest, executionContext) {
            mutationExecutionContext = executionContext;
            return { data: { saved: true }, summary: "Record saved" };
        }
    });

    registry.register({
        name: "test.failure",
        declaration: declaration("test.failure", CAPABILITY_BEHAVIORS.READ_ONLY),
        execute() {
            const error = new Error("Raw provider secret and Axios response");
            error.code = "PROVIDER_TIMEOUT_REFERENCE";
            error.retryable = true;
            error.response = { token: "secret" };
            throw error;
        }
    });

    const times = [
        "2026-08-13T12:00:01.000Z",
        "2026-08-13T12:00:02.000Z",
        "2026-08-13T12:00:03.000Z",
        "2026-08-13T12:00:04.000Z",
        "2026-08-13T12:00:05.000Z"
    ];
    const gateway = new CapabilityGateway({
        registry,
        clock: () => new Date(times.shift())
    });

    const readResult = await gateway.execute(request("test.reader", "read"));
    assert.strictEqual(readResult.status, "completed");
    assert.strictEqual(readResult.recordCount, 2);
    assert.strictEqual(readResult.outputContractVersion, "1.1");
    assert.strictEqual(readResult.executionMetadata.behavior, "read_only");
    assert.strictEqual(readExecutionContext.readOnly, true);
    assert.strictEqual(readExecutionContext.mutating, false);

    const unauthorized = await gateway.execute(request("test.writer", "write"));
    assert.strictEqual(unauthorized.code, "CAPABILITY_MUTATION_AUTHORITY_REQUIRED");
    assert.strictEqual(mutationExecutionContext, undefined);

    const incomplete = await gateway.execute(request("test.writer", "write", {
        context: { approvalVerified: true },
        constraints: { approvedMutation: true }
    }));
    assert.strictEqual(incomplete.code,
        "CAPABILITY_MUTATION_PAYLOAD_BINDING_REQUIRED");

    const missingIdempotency = await gateway.execute(request("test.writer", "write", {
        context: { approvalVerified: true, payloadHash: "payload-hash" },
        constraints: { approvedMutation: true }
    }));
    assert.strictEqual(missingIdempotency.code,
        "CAPABILITY_MUTATION_IDEMPOTENCY_REQUIRED");

    const mutationResult = await gateway.execute(request("test.writer", "write", {
        context: { approvalVerified: true, payloadHash: "payload-hash",
            idempotencyKey: "mutation-1" },
        constraints: { approvedMutation: true }
    }));
    assert.strictEqual(mutationResult.data.saved, true);
    assert.strictEqual(mutationResult.executionMetadata.behavior, "mutating");
    assert.strictEqual(mutationExecutionContext.readOnly, false);
    assert.strictEqual(mutationExecutionContext.mutating, true);

    const invalidPolicy = { ...declaration("test.invalid", CAPABILITY_BEHAVIORS.MUTATING,
        ["write"]), operationPolicies: { write: { access: "unknown" } } };
    registry.register({ name: "test.invalid", declaration: invalidPolicy,
        execute() { throw new Error("must not execute"); } });
    const invalidPolicyResult = await gateway.execute(request("test.invalid", "write"));
    assert.strictEqual(invalidPolicyResult.code, "CAPABILITY_DECLARATION_INVALID");

    const unsupported = await gateway.execute(request("test.reader", "write"));
    assert.strictEqual(unsupported.code, "CAPABILITY_OPERATION_UNSUPPORTED");

    const missing = await gateway.execute(request("test.missing", "read"));
    assert.strictEqual(missing.code, "CAPABILITY_NOT_FOUND");

    const invalid = await gateway.execute({ capability: "test.reader", operation: "read" });
    assert.strictEqual(invalid.code, "CAPABILITY_REQUEST_INVALID");

    const failure = await gateway.execute(request("test.failure", "read"));
    assert.strictEqual(failure.code, "CAPABILITY_EXECUTION_FAILED");
    assert.strictEqual(failure.message, "Capability execution failed");
    assert.strictEqual(failure.retryable, true);
    assert.strictEqual(failure.internalCauseReference, "PROVIDER_TIMEOUT_REFERENCE");
    assert.strictEqual(Object.hasOwn(failure, "cause"), false);
    assert.strictEqual(Object.hasOwn(failure, "response"), false);
    assert.strictEqual(JSON.stringify(failure).includes("secret"), false);
    assert.strictEqual(JSON.stringify(failure).includes("Axios"), false);

    console.log("Capability Gateway test passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
