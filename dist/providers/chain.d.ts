import { type Availability, type FareBreakdown, type LiveTrainStatus, type PnrStatus, type ScheduleStop, type Station, type Train, type TrainBetweenStations } from '../types.js';
import type { AvailabilityQuery, FareQuery, RailProvider, TrainsBetweenQuery } from './provider.js';
export interface ChainOptions {
    providers: RailProvider[];
    /** Called with each non-fatal failure, for diagnostics on stderr. */
    onFallback?: (providerName: string, method: string, error: Error) => void;
}
/**
 * Tries each provider in turn for every capability.
 *
 * Providers differ in what they cover: ConfirmTkt has live availability and
 * fares but no route; eRail has routes but no availability. Chaining them
 * per-call means every tool gets the best source that can actually answer it,
 * and adding a keyed provider simply puts a better source at the front.
 */
export declare class ChainProvider implements RailProvider {
    readonly name: string;
    readonly isLive: boolean;
    private readonly providers;
    private readonly onFallback;
    constructor(options: ChainOptions);
    /** Names of the chained providers, for reporting to the model. */
    get members(): string[];
    private attempt;
    searchStations(query: string, limit: number): Promise<Station[]>;
    getStation(code: string): Promise<Station | null>;
    /**
     * An empty result and a total outage must not look alike: reporting "no
     * direct trains" when every source was simply unreachable would be a
     * confident wrong answer. An empty list is only returned when at least one
     * provider actually answered and said there was nothing.
     */
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
