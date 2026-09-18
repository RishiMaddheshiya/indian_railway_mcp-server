import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type ProviderConfig } from './providers/index.js';
import type { RailProvider } from './providers/provider.js';
export declare const SERVER_NAME = "irctc-mcp";
export declare const SERVER_VERSION = "1.0.0";
export interface BuildOptions {
    provider?: RailProvider;
    config?: ProviderConfig;
}
/** Build a fully wired MCP server. Exported so tests can drive it directly. */
export declare function buildServer(options?: BuildOptions): {
    server: McpServer;
    provider: RailProvider;
};
