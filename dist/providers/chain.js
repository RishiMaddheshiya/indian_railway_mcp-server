import { RailDataError, } from '../types.js';
/** Errors that mean "this source can't answer" rather than "the answer is no". */
const FALL_THROUGH_CODES = new Set([
    'NOT_SUPPORTED',
    'UPSTREAM_ERROR',
    'UPSTREAM_TIMEOUT',
    'UPSTREAM_UNREACHABLE',
    'UPSTREAM_AUTH',
    'UPSTREAM_BAD_JSON',
    'UPSTREAM_BUSY',
    'UPSTREAM_NO_DATA',
    'RATE_LIMITED',
    'NO_STATIONS',
    'NO_SCHEDULE',
    'NO_FARE',
    'NO_AVAILABILITY',
    'PNR_PARSE_FAILED',
    'DATE_REQUIRED',
]);
/**
 * Errors that are a real answer about the user's query and must NOT be
 * retried against another source — doing so would turn a precise message
 * ("that train has no 3A") into a vague one from a weaker provider.
 */
function isDefinitive(error) {
    return error instanceof RailDataError && !FALL_THROUGH_CODES.has(error.code);
}
/** Actionable guidance for capabilities the key-free sources do not cover. */
const METHOD_HINTS = {
    get_live_train_status: 'Live running status is the one capability no key-free source exposes. ' +
        'Get a free RapidAPI key (see API_KEYS.md) and set IRCTC_RAPIDAPI_KEY to enable it.',
};
/**
 * Tries each provider in turn for every capability.
 *
 * Providers differ in what they cover: ConfirmTkt has live availability and
 * fares but no route; eRail has routes but no availability. Chaining them
 * per-call means every tool gets the best source that can actually answer it,
 * and adding a keyed provider simply puts a better source at the front.
 */
export class ChainProvider {
    name;
    isLive;
    providers;
    onFallback;
    constructor(options) {
        if (options.providers.length === 0) {
            throw new Error('ChainProvider needs at least one provider');
        }
        this.providers = options.providers;
        this.onFallback = options.onFallback;
        this.name = options.providers.map((p) => p.name).join('+');
        this.isLive = options.providers.some((p) => p.isLive);
    }
    /** Names of the chained providers, for reporting to the model. */
    get members() {
        return this.providers.map((p) => p.name);
    }
    async attempt(method, run) {
        const failures = [];
        for (const provider of this.providers) {
            try {
                return await run(provider);
            }
            catch (error) {
                if (isDefinitive(error))
                    throw error;
                const err = error instanceof Error ? error : new Error(String(error));
                failures.push(`${provider.name}: ${err.message}`);
                this.onFallback?.(provider.name, method, err);
            }
        }
        const hint = METHOD_HINTS[method];
        throw new RailDataError('ALL_PROVIDERS_FAILED', `No configured data source could answer ${method}.`, [hint, `Tried — ${failures.join(' | ')}`].filter(Boolean).join(' '));
    }
    searchStations(query, limit) {
        return this.attempt('search_stations', (p) => p.searchStations(query, limit));
    }
    async getStation(code) {
        for (const provider of this.providers) {
            try {
                const station = await provider.getStation(code);
                if (station)
                    return station;
            }
            catch (error) {
                if (isDefinitive(error))
                    throw error;
            }
        }
        return null;
    }
    /**
     * An empty result and a total outage must not look alike: reporting "no
     * direct trains" when every source was simply unreachable would be a
     * confident wrong answer. An empty list is only returned when at least one
     * provider actually answered and said there was nothing.
     */
    async findTrainsBetweenStations(query) {
        const failures = [];
        let answeredEmpty = false;
        for (const provider of this.providers) {
            try {
                const results = await provider.findTrainsBetweenStations(query);
                if (results.length > 0)
                    return results;
                answeredEmpty = true;
            }
            catch (error) {
                if (isDefinitive(error))
                    throw error;
                const err = error instanceof Error ? error : new Error(String(error));
                failures.push(`${provider.name}: ${err.message}`);
                this.onFallback?.(provider.name, 'find_trains_between_stations', err);
            }
        }
        if (answeredEmpty)
            return [];
        throw new RailDataError('ALL_PROVIDERS_FAILED', 'No configured data source could answer find_trains_between_stations.', `Tried — ${failures.join(' | ')}`);
    }
    getTrainSchedule(trainNumber) {
        return this.attempt('get_train_schedule', (p) => p.getTrainSchedule(trainNumber));
    }
    getAvailability(query) {
        return this.attempt('check_seat_availability', (p) => p.getAvailability(query));
    }
    getFare(query) {
        return this.attempt('get_fare', (p) => p.getFare(query));
    }
    getPnrStatus(pnr) {
        return this.attempt('get_pnr_status', (p) => p.getPnrStatus(pnr));
    }
    getLiveTrainStatus(trainNumber, startDate) {
        return this.attempt('get_live_train_status', (p) => p.getLiveTrainStatus(trainNumber, startDate));
    }
}
//# sourceMappingURL=chain.js.map