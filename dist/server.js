import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { configFromEnv, createProvider } from './providers/index.js';
import { registerPrompts } from './prompts.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools/register.js';
export const SERVER_NAME = 'irctc-mcp';
export const SERVER_VERSION = '1.0.0';
/** Build a fully wired MCP server. Exported so tests can drive it directly. */
export function buildServer(options = {}) {
    const provider = options.provider ?? createProvider(options.config ?? configFromEnv());
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, {
        instructions: [
            'Indian Railways / IRCTC travel tools.',
            '',
            'Most tools need a station CODE (NDLS, BCT, HWH) and a five digit train number.',
            'Station names are accepted and resolved automatically; when a city has several',
            'stations the tool will say so rather than guess.',
            '',
            'For "how do I get from A to B", prefer plan_journey — it compares trains,',
            'availability and fares in one call. Use the individual tools to drill in.',
            '',
            'Dates are ISO YYYY-MM-DD in Indian Standard Time, and "today"/"tomorrow" work.',
            '',
            'This server is READ-ONLY: it cannot book, cancel or pay for tickets. Booking',
            'must be completed by the user on IRCTC or an authorised agent.',
            '',
            provider.isLive
                ? [
                    'Data is LIVE, from unofficial public rail endpoints (the same feeds public',
                    'enquiry sites use). It is best-effort, not an official IRCTC partner feed,',
                    'so tell the user to confirm on IRCTC before booking or travelling.',
                    'If a tool reports that no source could answer, say so plainly rather than',
                    'guessing a figure.',
                ].join('\n')
                : [
                    'OFFLINE MODE is active: answers come from a bundled sample timetable, and',
                    'availability, PNR and running status are SIMULATED, not real. You MUST say',
                    'so whenever you report them. Never present these numbers as real.',
                ].join('\n'),
        ].join('\n'),
    });
    registerTools(server, provider);
    registerResources(server, provider);
    registerPrompts(server);
    return { server, provider };
}
//# sourceMappingURL=server.js.map