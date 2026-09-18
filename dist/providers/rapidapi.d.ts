import { type Availability, type FareBreakdown, type LiveTrainStatus, type PnrStatus, type ScheduleStop, type Station, type Train, type TrainBetweenStations } from '../types.js';
import { computeFare } from '../util/fares.js';
import type { AvailabilityQuery, FareQuery, RailProvider, TrainsBetweenQuery } from './provider.js';
export interface RapidApiOptions {
    apiKey: string;
    /** RapidAPI host, defaults to the widely used `irctc1.p.rapidapi.com`. */
    host?: string;
    /** Per-request timeout in milliseconds. */
    timeoutMs?: number;
    /**
     * Fall back to the bundled dataset when the upstream call fails.
     * Useful for demos; off by default so failures stay visible.
     */
    fallbackToMock?: boolean;
}
/**
 * Live provider backed by a RapidAPI Indian Railways gateway.
 *
 * The default host (`irctc1.p.rapidapi.com`) exposes the endpoints used
 * below. Other gateways differ; if you switch hosts you will likely need to
 * adjust the paths and the `normalise*` helpers, which is exactly why those
 * are isolated here rather than spread through the tool layer.
 *
 * Upstream responses are unofficial scrapes of public railway enquiry
 * services, not an IRCTC partner feed. Treat them as best-effort.
 */
export declare class RapidApiProvider implements RailProvider {
    readonly name = "rapidapi";
    readonly isLive = true;
    private readonly apiKey;
    private readonly host;
    private readonly timeoutMs;
    private readonly fallbackToMock;
    private readonly fallback;
    private readonly cache;
    constructor(options: RapidApiOptions);
    private request;
    /** Run `live`, optionally degrading to the bundled dataset on failure. */
    private withFallback;
    searchStations(query: string, limit: number): Promise<Station[]>;
    getStation(code: string): Promise<Station | null>;
    findTrainsBetweenStations(query: TrainsBetweenQuery): Promise<TrainBetweenStations[]>;
    getTrainSchedule(trainNumber: string): Promise<{
        train: Train;
        stops: ScheduleStop[];
    }>;
    getAvailability(query: AvailabilityQuery): Promise<Availability>;
    getFare(query: FareQuery): Promise<FareBreakdown>;
    getPnrStatus(pnr: string): Promise<PnrStatus>;
    getLiveTrainStatus(trainNumber: string, startDate: string): Promise<LiveTrainStatus>;
}
/** Exported for the fare estimator used when upstream omits a class. */
export { computeFare };
