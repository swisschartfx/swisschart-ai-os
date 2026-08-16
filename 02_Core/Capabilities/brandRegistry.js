const fs = require("fs");
const path = require("path");

const SUPPORTED_REGISTRY_VERSION = "1.0";
const DEFAULT_CONFIG_PATH = path.join(
    __dirname,
    "../../01_Core/Configuration/brandIdentity.json"
);

class BrandRegistry {
    constructor(options = {}) {
        this.configPath = options.configPath || DEFAULT_CONFIG_PATH;
        this.config = options.config || loadJson(this.configPath);
        validateConfig(this.config);
    }

    getProfile(platform, contentType) {
        requireString(platform, "BRAND_PLATFORM_REQUIRED", "platform is required");
        requireString(contentType, "BRAND_CONTENT_TYPE_REQUIRED", "contentType is required");

        const platformExists = this.config.platformProfiles.some((profile) =>
            profile.platform === platform);
        if (!platformExists) {
            throw brandError("BRAND_PLATFORM_UNKNOWN", `Unknown brand platform: ${platform}`);
        }

        const profile = this.config.platformProfiles.find((candidate) =>
            candidate.platform === platform && candidate.contentType === contentType);
        if (!profile) {
            throw brandError(
                "BRAND_CONTENT_TYPE_UNKNOWN",
                `Unknown brand content type for ${platform}: ${contentType}`
            );
        }

        return clone({
            registryVersion: this.config.registryVersion,
            brandVersion: this.config.brandVersion,
            profileVersion: profile.profileVersion,
            platform,
            contentType,
            identity: this.config.identity,
            visualIdentity: this.config.visualIdentity,
            communicationIdentity: resolveCommunication(this.config, profile)
        });
    }

    getAsset(assetId) {
        requireString(assetId, "BRAND_ASSET_ID_REQUIRED", "assetId is required");
        const asset = this.config.assets.find((candidate) => candidate.assetId === assetId);
        if (!asset) {
            throw brandError("BRAND_ASSET_NOT_FOUND", `Brand asset not found: ${assetId}`);
        }
        return clone(asset);
    }

    listAssets() {
        return clone(this.config.assets);
    }

    getRule(ruleId) {
        requireString(ruleId, "BRAND_RULE_ID_REQUIRED", "ruleId is required");
        const rules = communicationRules(this.config.communicationIdentity);
        const rule = rules.find((candidate) => candidate.ruleId === ruleId);
        if (!rule) {
            throw brandError("BRAND_RULE_NOT_FOUND", `Required brand rule not found: ${ruleId}`);
        }
        return clone(rule);
    }

    proposeChange(proposal) {
        return {
            status: "proposal_only",
            registryVersion: this.config.registryVersion,
            proposal: clone(proposal || {})
        };
    }

    mutate() {
        throw brandError(
            "BRAND_MUTATION_UNAUTHORIZED",
            "Canonical brand data requires Founder-authorized write and approval"
        );
    }
}

function validateConfig(config) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
        throw brandError("BRAND_CONFIG_INVALID", "Brand configuration must be an object");
    }
    if (config.registryVersion !== SUPPORTED_REGISTRY_VERSION) {
        throw brandError(
            "BRAND_REGISTRY_VERSION_UNSUPPORTED",
            `Unsupported Brand Registry version: ${config.registryVersion}`
        );
    }
    for (const field of [
        "brandVersion", "identity", "visualIdentity", "communicationIdentity",
        "platformProfiles", "assets", "accessControl"
    ]) {
        if (config[field] === undefined || config[field] === null) {
            throw brandError("BRAND_CONFIG_INVALID", `Brand configuration field is required: ${field}`);
        }
    }
    if (typeof config.brandVersion !== "string" || !config.brandVersion.trim() ||
        !Array.isArray(config.platformProfiles) || !Array.isArray(config.assets)) {
        throw brandError("BRAND_CONFIG_INVALID", "Brand configuration has invalid field types");
    }
    config.platformProfiles.forEach((profile) => {
        for (const field of ["platform", "contentType", "profileVersion"]) {
            requireString(profile[field], "BRAND_CONFIG_INVALID", `Profile ${field} is required`);
        }
    });
    config.assets.forEach((asset) => {
        for (const field of ["assetId", "type", "reference", "version"]) {
            requireString(asset[field], "BRAND_CONFIG_INVALID", `Asset ${field} is required`);
        }
        if (!asset.metadata || typeof asset.metadata !== "object" || Array.isArray(asset.metadata)) {
            throw brandError("BRAND_CONFIG_INVALID", "Asset metadata must be an object");
        }
    });
    return config;
}

function resolveCommunication(config, profile) {
    const communication = config.communicationIdentity;
    return {
        toneRules: selectRules(communication.toneRules, profile.toneRuleIds),
        writingRules: selectRules(communication.writingRules, profile.writingRuleIds),
        formattingRules: selectRules(communication.formattingRules, profile.formattingRuleIds),
        ctaDefinitions: selectBy(communication.ctaDefinitions, profile.ctaIds, "ctaId"),
        footerDefinitions: selectBy(communication.footerDefinitions, [profile.footerId], "footerId"),
        sloganUsageRules: communication.sloganUsageRules
    };
}

function selectRules(rules, ids) {
    return selectBy(rules, ids, "ruleId");
}

function selectBy(items, ids, key) {
    return (ids || []).map((id) => {
        const item = (items || []).find((candidate) => candidate[key] === id);
        if (!item) {
            throw brandError("BRAND_RULE_NOT_FOUND", `Required brand reference not found: ${id}`);
        }
        return item;
    });
}

function communicationRules(identity) {
    return [
        ...(identity.toneRules || []),
        ...(identity.writingRules || []),
        ...(identity.formattingRules || [])
    ];
}

function loadJson(configPath) {
    try {
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (cause) {
        const error = brandError("BRAND_CONFIG_INVALID", "Brand configuration could not be loaded");
        error.cause = cause;
        throw error;
    }
}

function requireString(value, code, message) {
    if (typeof value !== "string" || !value.trim()) {
        throw brandError(code, message);
    }
}

function brandError(code, message) {
    const error = new Error(message);
    error.code = code;
    error.retryable = false;
    return error;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

module.exports = BrandRegistry;
module.exports.SUPPORTED_REGISTRY_VERSION = SUPPORTED_REGISTRY_VERSION;
module.exports.validateConfig = validateConfig;
