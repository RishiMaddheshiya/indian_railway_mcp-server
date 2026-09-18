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
/** Read provider configuration from the environment. */
export declare function configFromEnv(env?: NodeJS.ProcessEnv): ProviderConfig;
/**
 * Build the configured provider.
 *
 * The default (`auto`) chains live sources so every tool returns real-time
 * data with no API key, and puts a keyed provider first when one is available
 * because it covers capabilities the key-free sources do not (notably live
 * running status).
 */
export declare function createProvider(config: ProviderConfig): RailProvider;
/** Human-readable description of what a built provider will do. */
export declare function describeProvider(provider: RailProvider): string;
