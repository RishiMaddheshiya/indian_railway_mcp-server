#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { describeProvider } from './providers/index.js';
import { buildServer, SERVER_NAME, SERVER_VERSION } from './server.js';
async function main() {
    const { server, provider } = buildServer();
    // stdout is the JSON-RPC channel — every diagnostic must go to stderr.
    process.stderr.write(`[${SERVER_NAME}] v${SERVER_VERSION} on stdio — ${describeProvider(provider)}\n`);
    if (!provider.isLive) {
        process.stderr.write(`[${SERVER_NAME}] WARNING: offline mode — availability, PNR and running status are simulated.\n`);
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
    const shutdown = async (signal) => {
        process.stderr.write(`[${SERVER_NAME}] received ${signal}, shutting down\n`);
        try {
            await server.close();
        }
        finally {
            process.exit(0);
        }
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
}
main().catch((error) => {
    process.stderr.write(`[${SERVER_NAME}] fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map