import { ChainProvider } from './chain.js';
import { ConfirmTktProvider } from './confirmtkt.js';
import { StationDirectoryProvider } from './directory.js';
import { ErailProvider } from './erail.js';
import { MockProvider } from './mock.js';
import { RapidApiProvider } from './rapidapi.js';
import type { RailProvider } from './provider.js';

export type { RailProvider } from './provider.js';
export { ChainProvider } from './chain.js';
export { ConfirmTktProvider } from './confirmtkt.js';
export { ErailProvider } from './erail.js';
export { MockProvider } from './mock.js';
export { RapidApiProvider } from './rapidapi.js';

export type ProviderName = 'auto' | 'confirmtkt' | 'erail' | 'rapidapi' | 'mock';

export interface ProviderConfig {
  provider: ProviderName;
  rapidApiKey?: string;
  rapidApiHost?: string;
  timeoutMs?: number;
  /** Append the offline estimator to the chain as a last resort. */
  offlineFallback?: boolean;
}

function parseList(value: string | undefined): ProviderName[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((v) => v.trim().toLowerCase())
    .filter((v): v is ProviderName =>
      ['auto', 'confirmtkt', 'erail', 'rapidapi', 'mock'].includes(v),
    );
}

/** Read provider configuration from the environment. */
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  const requested = parseList(env['IRCTC_PROVIDER'])[0] ?? 'auto';
  const key = env['IRCTC_RAPIDAPI_KEY']?.trim();

  const config: ProviderConfig = { provider: requested };
  if (key) config.rapidApiKey = key;

  const host = env['IRCTC_RAPIDAPI_HOST']?.trim();
  if (host) config.rapidApiHost = host;

  const timeout = Number(env['IRCTC_TIMEOUT_MS']);
  if (Number.isFinite(timeout) && timeout > 0) config.timeoutMs = timeout;

  // Off by default: a silent drop to estimated data is worse than a clear
  // error saying the live sources could not be reached.
  config.offlineFallback = (env['IRCTC_OFFLINE_FALLBACK'] ?? '').toLowerCase() === 'true';

  return config;
}

function buildRapidApi(config: ProviderConfig): RapidApiProvider | null {
  if (!config.rapidApiKey) return null;
  const options: ConstructorParameters<typeof RapidApiProvider>[0] = {
    apiKey: config.rapidApiKey,
  };
  if (config.rapidApiHost) options.host = config.rapidApiHost;
  if (config.timeoutMs) options.timeoutMs = config.timeoutMs;
  return new RapidApiProvider(options);
}

/**
 * Build the configured provider.
 *
 * The default (`auto`) chains live sources so every tool returns real-time
 * data with no API key, and puts a keyed provider first when one is available
 * because it covers capabilities the key-free sources do not (notably live
 * running status).
 */
export function createProvider(config: ProviderConfig): RailProvider {
  const timeout = config.timeoutMs ?? 15_000;

  const onFallback = (provider: string, method: string, error: Error): void => {
    process.stderr.write(`[irctc-mcp] ${provider} could not serve ${method}: ${error.message}\n`);
  };

  switch (config.provider) {
    case 'mock':
      return new MockProvider();

    case 'confirmtkt':
      return new ConfirmTktProvider(timeout);

    case 'erail':
      return new ErailProvider(timeout);

    case 'rapidapi': {
      const rapid = buildRapidApi(config);
      if (!rapid) {
        process.stderr.write(
          '[irctc-mcp] IRCTC_PROVIDER=rapidapi but IRCTC_RAPIDAPI_KEY is not set; falling back to the key-free live sources.\n',
        );
        break;
      }
      return rapid;
    }

    case 'auto':
    default:
      break;
  }

  const providers: RailProvider[] = [];

  const rapid = buildRapidApi(config);
  if (rapid) providers.push(rapid);

  providers.push(new ConfirmTktProvider(timeout));
  providers.push(new ErailProvider(timeout));

  // Station codes are static reference data, so resolving them locally is
  // accurate and keeps every other tool working when station search is down.
  providers.push(new StationDirectoryProvider());

  if (config.offlineFallback) providers.push(new MockProvider());

  return new ChainProvider({ providers, onFallback });
}

/** Human-readable description of what a built provider will do. */
export function describeProvider(provider: RailProvider): string {
  if (provider instanceof ChainProvider) {
    return `chain: ${provider.members.join(' -> ')}`;
  }
  return provider.isLive ? `${provider.name} (live)` : `${provider.name} (offline sample data)`;
}
