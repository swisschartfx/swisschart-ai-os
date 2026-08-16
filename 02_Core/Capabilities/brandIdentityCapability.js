const BrandRegistry = require("./brandRegistry");
const {
    EXECUTION_MODES,
    CAPABILITY_BEHAVIORS,
    APPROVAL_REQUIREMENTS,
    LIFECYCLE_STAGES,
    createCapabilityDeclaration
} = require("./capabilityContract");

const BRAND_OPERATIONS = Object.freeze({
    PROFILE_GET: "brand.profile.get",
    ASSET_GET: "brand.asset.get",
    RULE_GET: "brand.rule.get",
    ASSETS_LIST: "brand.assets.list"
});

class BrandIdentityCapability {
    constructor(options = {}) {
        this.name = "brand.identity";
        this.brandRegistry = options.brandRegistry || new BrandRegistry();
        this.declaration = createCapabilityDeclaration({
            capabilityId: this.name,
            domain: "brand",
            version: "1.0.0",
            supportedOperations: Object.values(BRAND_OPERATIONS),
            executionMode: EXECUTION_MODES.SYNCHRONOUS,
            behavior: CAPABILITY_BEHAVIORS.READ_ONLY,
            approvalRequirement: APPROVAL_REQUIREMENTS.NONE,
            lifecycleSupport: [LIFECYCLE_STAGES.COLLECT],
            inputContractVersion: "1.0",
            outputContractVersion: "1.0"
        });
    }

    async execute(request) {
        let data;
        let summary;

        switch (request.operation) {
            case BRAND_OPERATIONS.PROFILE_GET:
                data = this.brandRegistry.getProfile(
                    request.input.platform,
                    request.input.contentType
                );
                summary = "Brand profile resolved";
                break;
            case BRAND_OPERATIONS.ASSET_GET:
                data = this.brandRegistry.getAsset(request.input.assetId);
                summary = "Brand asset resolved";
                break;
            case BRAND_OPERATIONS.RULE_GET:
                data = this.brandRegistry.getRule(request.input.ruleId);
                summary = "Brand rule resolved";
                break;
            case BRAND_OPERATIONS.ASSETS_LIST:
                data = { assets: this.brandRegistry.listAssets() };
                summary = "Brand assets listed";
                break;
            default: {
                const error = new Error("Unsupported Brand Identity operation");
                error.code = "BRAND_OPERATION_UNSUPPORTED";
                throw error;
            }
        }

        return {
            data,
            summary,
            evidence: [],
            sourceReferences: ["brand-registry"],
            recordCount: request.operation === BRAND_OPERATIONS.ASSETS_LIST
                ? data.assets.length
                : null,
            executionMetadata: {
                registryVersion: this.brandRegistry.config.registryVersion,
                brandVersion: this.brandRegistry.config.brandVersion
            }
        };
    }
}

module.exports = BrandIdentityCapability;
module.exports.BRAND_OPERATIONS = BRAND_OPERATIONS;
