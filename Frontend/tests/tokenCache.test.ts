import test from "node:test";
import assert from "node:assert/strict";
import { createTokenCache, readJwtExpiry } from "../src/utils/tokenCache.js";

const jwtWithExp = (exp: number) =>
    `x.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.y`;

test("readJwtExpiry reads exp and rejects malformed tokens", () => {
    assert.equal(readJwtExpiry(jwtWithExp(1_900_000_000)), 1_900_000_000);
    assert.equal(readJwtExpiry("not-a-jwt"), null);
});

test("reuses a token until shortly before it expires", async () => {
    let clock = 0;
    let calls = 0;
    const cache = createTokenCache(async () => {
        calls += 1;
        return jwtWithExp(15 * 60);
    }, () => clock);

    await cache.get();
    clock = 13 * 60 * 1000;
    await cache.get();
    assert.equal(calls, 1);

    clock = 14 * 60 * 1000 + 1;
    await cache.get();
    assert.equal(calls, 2);
});

test("parallel callers share one fetch", async () => {
    let calls = 0;
    const cache = createTokenCache(async () => {
        calls += 1;
        return jwtWithExp(Date.now() / 1000 + 900);
    });

    const tokens = await Promise.all([cache.get(), cache.get(), cache.get()]);
    assert.equal(calls, 1);
    assert.equal(new Set(tokens).size, 1);
});

test("remembers signed-out until cleared", async () => {
    let token: string | null = null;
    let calls = 0;
    const cache = createTokenCache(async () => {
        calls += 1;
        return token;
    });

    assert.equal(await cache.get(), null);
    assert.equal(await cache.get(), null);
    assert.equal(calls, 1);

    token = jwtWithExp(Date.now() / 1000 + 900);
    cache.clear();
    assert.equal(await cache.get(), token);
});
