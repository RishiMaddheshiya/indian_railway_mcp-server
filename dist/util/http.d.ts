/** A browser UA avoids bot heuristics on the public endpoints we call. */
export declare const BROWSER_UA: string;
/**
 * Small fetch wrapper shared by the live providers: timeouts, a response
 * cache, and upstream failures mapped onto RailDataError so tool handlers
 * never see a raw network exception.
 */
export declare class HttpClient {
    private readonly cache;
    private readonly timeoutMs;
    constructor(timeoutMs?: number);
    /** Clear cached responses (used by tests). */
    clearCache(): void;
    getText(url: string, options?: {
        headers?: Record<string, string>;
        cacheTtlMs?: number;
        label?: string;
    }): Promise<string>;
    getJson<T>(url: string, options?: {
        headers?: Record<string, string>;
        cacheTtlMs?: number;
        label?: string;
    }): Promise<T>;
}
/** Convert an ISO date (YYYY-MM-DD) to the DD-MM-YYYY some upstreams want. */
export declare function toDdMmYyyy(isoDate: string): string;
/** Normalise erail's "HH.mm" (and stray markers) to "HH:mm" or null. */
export declare function normaliseTime(raw: string | undefined | null): string | null;
