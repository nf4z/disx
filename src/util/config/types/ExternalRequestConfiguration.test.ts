import assert from "node:assert/strict";
import { test } from "node:test";
import { ExternalRequestConfiguration, allowsCdnUpstream } from "./ExternalRequestConfiguration";

test("local-first defaults permit only Discord decoration art", () => {
    const policy = new ExternalRequestConfiguration();
    assert.deepEqual(
        Object.entries(policy)
            .filter(([, value]) => value)
            .map(([key]) => key),
        ["discordDecorations", "discordClientAssets"],
    );
    for (const path of [
        "avatar-decoration-presets/a_0123456789.png",
        "assets/collectibles/nameplates/video.webm",
        "assets/profile_effects/effect.png",
        "media/v1/collectibles-shop/123/static",
    ])
        assert.equal(allowsCdnUpstream(policy, `https://cdn.discordapp.com/${path}`), true, path);
    for (const path of ["stickers/123.png", "bad-domains/hashes.json", "assets/content/image.png", "app-icons/123/hash.png", "soundboard-sounds/123"])
        assert.equal(allowsCdnUpstream(policy, `https://cdn.discordapp.com/${path}`), false, path);
});

test("decoration exception cannot bypass origin, transport or path restrictions", () => {
    const policy = new ExternalRequestConfiguration();
    for (const url of [
        "https://example.com/avatar-decoration-presets/image.png",
        "https://cdn.discordapp.com.example.com/avatar-decoration-presets/image.png",
        "http://cdn.discordapp.com/avatar-decoration-presets/image.png",
        "https://user@cdn.discordapp.com/avatar-decoration-presets/image.png",
        "https://cdn.discordapp.com:8443/avatar-decoration-presets/image.png",
        "https://cdn.discordapp.com/avatar-decoration-presets/../stickers/123.png",
        "https://cdn.discordapp.com/avatar-decoration-presets/image%2fextra.png",
        "https://cdn.discordapp.com/avatar-decoration-presets/",
        "not a URL",
    ])
        assert.equal(allowsCdnUpstream(policy, url), false, url);
    policy.discordDecorations = false;
    policy.discordAssetFallback = true;
    assert.equal(allowsCdnUpstream(policy, "https://cdn.discordapp.com/avatar-decoration-presets/image.png"), false);
    assert.equal(allowsCdnUpstream(policy, "https://cdn.discordapp.com/stickers/123.png"), true);
    assert.equal(allowsCdnUpstream(policy, "https://example.com/stickers/123.png"), false);
});
