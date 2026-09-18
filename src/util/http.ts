import { RailDataError } from '../types.js';

/** A browser UA avoids bot heuristics on the public endpoints we call. */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Small fetch wrapper shared by the live providers: timeouts, a response
 * cache, and upstream failures mapped onto RailDataError so tool handlers
 * never see a raw network exception.
 */
export class HttpClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly timeoutMs: number;

  constructor(timeoutMs = 15_000) {
    this.timeoutMs = timeoutMs;
  }

  /** Clear cached responses (used by tests). */
  clearCache(): void {
    this.cache.clear();
  }

  async getText(
    url: string,
    options: { headers?: Record<string, string>; cacheTtlMs?: number; label?: string } = {},
  ): Promise<string> {
    const { headers = {}, cacheTtlMs = 60_000, label = 'rail data provider' } = options;

    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as string;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA, ...headers },
        signal: controller.signal,
        redirect: 'follow',
      });

      if (response.status === 401 || response.status === 403) {
        throw new RailDataError(
          'UPSTREAM_AUTH',
          `${label} refused the request (HTTP ${response.status}).`,
          'If this provider needs an API key, check it is set correctly.',
        );
      }
      if (response.status === 429) {
        throw new RailDataError(
          'RATE_LIMITED',
          `${label} is rate limiting this client.`,
          'Wait a little and retry, or configure a provider with a higher quota.',
        );
      }
      if (!response.ok) {
        throw new RailDataError(
          'UPSTREAM_ERROR',
          `${label} returned HTTP ${response.status}.`,
        );
      }

      const text = await response.text();
      this.cache.set(url, { value: text, expiresAt: Date.now() + cacheTtlMs });
      return text;
    } catch (error) {
      if (error instanceof RailDataError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RailDataError(
          'UPSTREAM_TIMEOUT',
          `${label} did not respond within ${this.timeoutMs}ms.`,
        );
      }
      throw new RailDataError(
        'UPSTREAM_UNREACHABLE',
        `Could not reach ${label}: ${(error as Error).message}`,
        'Check network access from this machine. Corporate proxies and offline environments will block these calls.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async getJson<T>(
    url: string,
    options: { headers?: Record<string, string>; cacheTtlMs?: number; label?: string } = {},
  ): Promise<T> {
    const text = await this.getText(url, options);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new RailDataError(
        'UPSTREAM_BAD_JSON',
        `${options.label ?? 'Provider'} returned a non-JSON response.`,
        text.slice(0, 160),
      );
    }
  }
}

/** Convert an ISO date (YYYY-MM-DD) to the DD-MM-YYYY some upstreams want. */
export function toDdMmYyyy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
}

/** Normalise erail's "HH.mm" (and stray markers) to "HH:mm" or null. */
export function normaliseTime(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value || value === '--' || /^(first|last|source|destination)$/i.test(value)) {
    return null;
  }
  const match = value.match(/^(\d{1,2})[.:](\d{2})/);
  if (!match) return null;
  const hh = match[1]!.padStart(2, '0');
  return `${hh}:${match[2]}`;
}
