const REFRESH_MARGIN_MS = 60_000;

// Reads "exp" (seconds) from a JWT without verifying it; the API server does the verifying.
export function readJwtExpiry(token: string): number | null {
    try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const { exp } = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "=")));
        return typeof exp === "number" ? exp : null;
    } catch {
        return null;
    }
}

/**
 * Keeps one API token in memory: reused until a minute before it expires, fetched once for
 * parallel callers. "Signed out" (null) is remembered until clear(), which sign-in and sign-out call.
 */
export function createTokenCache(fetchToken: () => Promise<string | null>, now: () => number = Date.now) {
    let cached: { token: string | null; expiresAt: number } | null = null;
    let pending: Promise<string | null> | null = null;

    return {
        get(): Promise<string | null> {
            if (cached && cached.expiresAt - now() > REFRESH_MARGIN_MS) return Promise.resolve(cached.token);
            pending ??= fetchToken()
                .then((token) => {
                    const exp = token ? readJwtExpiry(token) : null;
                    cached = token && exp ? { token, expiresAt: exp * 1000 } : { token: null, expiresAt: Infinity };
                    return cached.token;
                })
                .finally(() => {
                    pending = null;
                });
            return pending;
        },
        clear() {
            cached = null;
        },
    };
}
