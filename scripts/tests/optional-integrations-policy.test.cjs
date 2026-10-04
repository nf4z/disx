const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(relative, config, overrides = {}) {
    const source = fs.readFileSync(path.join(__dirname, "../..", relative), "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const module = { exports: {} };
    const context = vm.createContext({
        module,
        exports: module.exports,
        Buffer,
        URL,
        URLSearchParams,
        AbortSignal,
        __dirname: path.dirname(relative),
        console: { log() {}, warn() {}, error() {} },
        fetch:
            overrides.fetch ??
            (() => {
                throw new Error("Unexpected outbound request");
            }),
        require(id) {
            if (id === "@spacebar/util")
                return {
                    Config: { get: () => config },
                    fetchPublicUrl:
                        overrides.fetch ??
                        (() => {
                            throw new Error("Unexpected outbound request");
                        }),
                };
            if (id === "@spacebar/extensions")
                return {
                    DateBuilder: class {
                        addHours() {
                            return this;
                        }
                        buildTimestamp() {
                            return Date.now() + 3600000;
                        }
                    },
                };
            if (id === "./ConnectionConfig") return { ConnectionConfig: overrides.connectionConfig };
            if (id === "./ConnectionStore") return { ConnectionStore: { connections: new Map() } };
            return require(id);
        },
    });
    vm.runInContext(js, context, { filename: relative });
    return module.exports;
}
function config(allowed = false) {
    return {
        externalRequests: { thirdParty: allowed },
        integrations: { gifs: { enabled: false, defaultProvider: "klipy", klipy: { enabled: false }, tenor: { enabled: false } } },
        security: {
            ipdataApiKey: "test-ip-key",
            abuseIpDbApiKey: "test-abuse-key",
            abuseipdbBlacklistRatelimit: 1,
            captcha: { enabled: true, service: "hcaptcha", sitekey: "local-key", secret: "local-secret" },
            webPush: { enabled: true, vapidPublicKey: "public-fixture" },
        },
    };
}

test("configured reputation lookups make zero requests with policy disabled", async () => {
    const cfg = config();
    const { IpDataClient } = load("src/util/util/networking/ipdata/IpDataClient.ts", cfg);
    const { AbuseIpDbClient } = load("src/util/util/networking/abuseipdb/AbuseIpDbClient.ts", cfg);
    const { StopForumSpamClient } = load("src/util/util/networking/stopforumspam/StopForumSpamClient.ts", cfg);
    assert.equal(await IpDataClient.getIpInfo("192.0.2.1"), null);
    assert.equal(await AbuseIpDbClient.checkIpAddress("192.0.2.1"), null);
    assert.equal(await AbuseIpDbClient.getBlacklist(), null);
    assert.equal(await AbuseIpDbClient.isIpBlacklisted("192.0.2.1"), false);
    assert.equal((await StopForumSpamClient.checkAsync("fixture@example.test", "192.0.2.1", "fixture")).success, 1);
});

test("AbuseIPDB opt-in uses the AbuseIPDB credential and bounded request", async () => {
    const cfg = config(true);
    delete cfg.security.ipdataApiKey;
    let requests = 0;
    const { AbuseIpDbClient } = load("src/util/util/networking/abuseipdb/AbuseIpDbClient.ts", cfg, {
        fetch: async (url, options) => {
            requests++;
            assert.equal(options.headers.Key, "test-abuse-key");
            assert.ok(options.signal);
            assert.ok(url.includes("ipAddress=192.0.2.1"));
            return { ok: true, json: async () => ({ data: { abuseConfidenceScore: 0 } }) };
        },
    });
    assert.equal((await AbuseIpDbClient.checkIpAddress("192.0.2.1")).data.abuseConfidenceScore, 0);
    assert.equal((await AbuseIpDbClient.checkIpAddress("192.0.2.1")).data.abuseConfidenceScore, 0);
    assert.equal(requests, 1);
    cfg.externalRequests.thirdParty = false;
    assert.equal(await AbuseIpDbClient.checkIpAddress("192.0.2.1"), null);
});

test("disabled external CAPTCHA does not send tokens and does not challenge", async () => {
    const { captchaEnabled, checkCaptcha, verifyCaptcha } = load("src/api/util/utility/captcha.ts", config());
    assert.equal(captchaEnabled(), false);
    assert.equal(await checkCaptcha(true, null), null);
    await assert.rejects(verifyCaptcha("sensitive-token"), /not configured/);
});

test("self-hosted Cap remains usable while third-party policy is disabled", async () => {
    const cfg = config();
    cfg.security.captcha.service = "cap";
    cfg.security.captcha.instance = "http://127.0.0.1:3000/";
    let requests = 0;
    const { captchaEnabled, verifyCaptcha } = load("src/api/util/utility/captcha.ts", cfg, {
        fetch: async (url, options) => {
            requests++;
            assert.equal(url, "http://127.0.0.1:3000/local-key/siteverify");
            assert.ok(options.signal);
            return { ok: true, json: async () => ({ success: true }) };
        },
    });
    assert.equal(captchaEnabled(), true);
    assert.equal((await verifyCaptcha("cap-token")).success, true);
    assert.equal(requests, 1);
});

test("browser push is unadvertised and skipped before key parsing or outbound fetch", async () => {
    const { vapidPublicKey, sendWebPush } = load("src/api/util/utility/webPush.ts", config());
    assert.equal(vapidPublicKey(), null);
    const result = await sendWebPush({ endpoint: "https://push.example.test/private", keys: {} }, { message: "private" });
    assert.equal(result.status, 503);
    assert.equal(result.gone, false);
    assert.equal(result.skipped, true);
});

test("explicit GIF switch prevents provider access and requests when disabled", async () => {
    const { GifProviderManager } = load("src/integrations/gifs/GifProviderManager.ts", config());
    // There is no providers directory in the VM fixture: disabled init must return first.
    await GifProviderManager.init();
    assert.equal(GifProviderManager.findProvider(), undefined);
    assert.equal(Object.keys(GifProviderManager.getProviders()).length, 0);
    assert.throws(() => GifProviderManager.getProvider("klipy"), /disabled/);
});

test("connection policy changes apply at runtime without changing stored settings", async () => {
    const cfg = config();
    const stored = { twitch: { enabled: true, clientId: "original" } };
    const connectionConfig = { get: () => stored, set: async (value) => Object.assign(stored, value) };
    const { ConnectionLoader } = load("src/util/connections/ConnectionLoader.ts", cfg, { connectionConfig });
    const effective = ConnectionLoader.getConnectionConfig("twitch");
    assert.equal(effective.enabled, false);
    assert.equal(stored.twitch.enabled, true);
    cfg.externalRequests.thirdParty = true;
    assert.equal(effective.enabled, true);
    cfg.externalRequests.thirdParty = false;
    await ConnectionLoader.setConnectionConfig("twitch", { clientId: "edited" });
    assert.equal(stored.twitch.enabled, true);
    assert.equal(stored.twitch.clientId, "edited");
});
