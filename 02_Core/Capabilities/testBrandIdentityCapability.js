const assert = require("assert");

const BrandRegistry = require("./brandRegistry");
const BrandIdentityCapability = require("./brandIdentityCapability");
const CapabilityRegistry = require("./capabilityRegistry");
const CapabilityGateway = require("./capabilityGateway");
const { createCapabilityRequest, validateCapabilityResult } = require("./capabilityContract");
const canonicalConfig = require("../../01_Core/Configuration/brandIdentity.json");

async function run() {
    const loadedRegistry = new BrandRegistry();
    assert.strictEqual(loadedRegistry.config.identity.brandName, "Swisschart");
    assert.strictEqual(loadedRegistry.config.registryVersion, "1.0");

    const profile = loadedRegistry.getProfile("telegram", "text");
    assert.strictEqual(profile.platform, "telegram");
    assert.strictEqual(profile.contentType, "text");
    assert.strictEqual(profile.registryVersion, "1.0");
    assert.strictEqual(profile.brandVersion, "1.0.0");
    assert.strictEqual(profile.profileVersion, "1.0.0");
    assert.strictEqual(
        profile.communicationIdentity.footerDefinitions[0].value,
        '<a href="https://linktr.ee/swisschart">Swisschart Links</a>'
    );

    assert.throws(
        () => loadedRegistry.getProfile("instagram", "text"),
        (error) => error.code === "BRAND_PLATFORM_UNKNOWN"
    );
    assert.throws(
        () => loadedRegistry.getProfile("telegram", "video"),
        (error) => error.code === "BRAND_CONTENT_TYPE_UNKNOWN"
    );

    const assetConfig = clone(canonicalConfig);
    assetConfig.assets.push({
        assetId: "test.asset",
        type: "logo",
        reference: "assets/test-logo.svg",
        version: "1.0.0",
        metadata: { fixture: true }
    });
    const assetRegistry = new BrandRegistry({ config: assetConfig });
    assert.deepStrictEqual(assetRegistry.getAsset("test.asset"), {
        assetId: "test.asset",
        type: "logo",
        reference: "assets/test-logo.svg",
        version: "1.0.0",
        metadata: { fixture: true }
    });
    assert.strictEqual(assetRegistry.listAssets().length, 1);
    assert.throws(
        () => loadedRegistry.getAsset("missing.asset"),
        (error) => error.code === "BRAND_ASSET_NOT_FOUND"
    );

    assert.throws(
        () => new BrandRegistry({ config: { registryVersion: "1.0" } }),
        (error) => error.code === "BRAND_CONFIG_INVALID"
    );
    assert.throws(
        () => new BrandRegistry({
            config: { ...clone(canonicalConfig), registryVersion: "2.0" }
        }),
        (error) => error.code === "BRAND_REGISTRY_VERSION_UNSUPPORTED"
    );

    const missingRuleConfig = clone(canonicalConfig);
    missingRuleConfig.platformProfiles[0].toneRuleIds.push("communication.missing");
    const missingRuleRegistry = new BrandRegistry({ config: missingRuleConfig });
    assert.throws(
        () => missingRuleRegistry.getProfile("telegram", "text"),
        (error) => error.code === "BRAND_RULE_NOT_FOUND"
    );
    assert.throws(
        () => loadedRegistry.getRule("communication.missing"),
        (error) => error.code === "BRAND_RULE_NOT_FOUND"
    );

    const proposal = loadedRegistry.proposeChange({ field: "identity.slogans" });
    assert.strictEqual(proposal.status, "proposal_only");
    assert.throws(
        () => loadedRegistry.mutate({ field: "identity.brandName" }),
        (error) => error.code === "BRAND_MUTATION_UNAUTHORIZED"
    );
    assert.strictEqual(loadedRegistry.config.accessControl.autonomousAgentMutation, false);

    const capability = new BrandIdentityCapability({ brandRegistry: loadedRegistry });
    const gateway = new CapabilityGateway({
        registry: new CapabilityRegistry([capability]),
        clock: createClock()
    });
    const gatewayResult = await gateway.execute(request(
        "brand.profile.get",
        { platform: "telegram", contentType: "text" }
    ));

    assert.strictEqual(validateCapabilityResult(gatewayResult).valid, true);
    assert.strictEqual(gatewayResult.status, "completed");
    assert.strictEqual(gatewayResult.capability, "brand.identity");
    assert.strictEqual(gatewayResult.data.brandVersion, "1.0.0");
    assert.strictEqual(gatewayResult.data.profileVersion, "1.0.0");
    assert.strictEqual(gatewayResult.executionMetadata.registryVersion, "1.0");

    const missingAssetResult = await gateway.execute(request(
        "brand.asset.get",
        { assetId: "missing.asset" }
    ));
    assert.strictEqual(missingAssetResult.code, "CAPABILITY_EXECUTION_FAILED");
    assert.strictEqual(missingAssetResult.internalCauseReference, "BRAND_ASSET_NOT_FOUND");

    console.log("Brand Identity Capability tests passed");
}

function request(operation, input) {
    return createCapabilityRequest({
        requestId: `request-${operation}`,
        capability: "brand.identity",
        operation,
        input,
        context: {},
        constraints: {},
        metadata: {},
        requestedBy: "authorized-capability",
        source: "brand-test",
        timestamp: "2026-08-13T16:00:00.000Z",
        inputContractVersion: "1.0"
    });
}

function createClock() {
    let tick = 0;
    return () => new Date(Date.UTC(2026, 7, 13, 16, 0, tick++));
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
