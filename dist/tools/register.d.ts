import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RailProvider } from '../providers/provider.js';
import { className, quotaName, runDays } from '../util/format.js';
export declare function registerTools(server: McpServer, provider: RailProvider): void;
/** Re-exported so the resource layer can describe the same vocabulary. */
export { className, quotaName, runDays };
