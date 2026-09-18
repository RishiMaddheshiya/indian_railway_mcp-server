import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { STATIONS } from './data/stations.js';
import { TRAINS } from './data/trains.js';
import { QUOTAS, TRAVEL_CLASSES } from './types.js';
export function registerResources(server, provider) {
    server.registerResource('stations', 'irctc://stations', {
        title: 'Station directory',
        description: 'Bundled directory of major Indian Railways stations with codes, states and zones.',
        mimeType: 'application/json',
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify({ count: STATIONS.length, stations: STATIONS }, null, 2),
            },
        ],
    }));
    server.registerResource('trains', 'irctc://trains', {
        title: 'Sample timetable',
        description: 'Bundled sample of popular trains with route, classes and days of operation.',
        mimeType: 'application/json',
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify({
                    count: TRAINS.length,
                    trains: TRAINS.map((t) => ({
                        ...t.train,
                        stopCount: t.stops.length,
                    })),
                }, null, 2),
            },
        ],
    }));
    server.registerResource('reference', 'irctc://reference', {
        title: 'Classes and quotas',
        description: 'Travel class codes and booking quota codes used across the tools.',
        mimeType: 'application/json',
    }, async (uri) => ({
        contents: [
            {
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify({
                    travelClasses: TRAVEL_CLASSES,
                    quotas: QUOTAS,
                    provider: { name: provider.name, isLive: provider.isLive },
                }, null, 2),
            },
        ],
    }));
    server.registerResource('train', new ResourceTemplate('irctc://train/{trainNumber}', { list: undefined }), {
        title: 'Train schedule',
        description: 'Full schedule for one train number, e.g. irctc://train/12951.',
        mimeType: 'application/json',
    }, async (uri, { trainNumber }) => {
        const number = Array.isArray(trainNumber) ? trainNumber[0] : trainNumber;
        try {
            const schedule = await provider.getTrainSchedule(String(number));
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify(schedule, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                contents: [
                    {
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2),
                    },
                ],
            };
        }
    });
}
//# sourceMappingURL=resources.js.map