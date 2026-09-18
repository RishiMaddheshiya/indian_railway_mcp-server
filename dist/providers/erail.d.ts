import { type Availability, type FareBreakdown, type LiveTrainStatus, type PnrStatus, type ScheduleStop, type Station, type Train, type TrainBetweenStations } from '../types.js';
import type { AvailabilityQuery, FareQuery, RailProvider, TrainsBetweenQuery } from './provider.js';
/**
 * Live provider backed by eRail's public data endpoints. No API key needed.
 *
 * eRail answers with a tilde/caret delimited text format rather than JSON.
 * The layout below was read off live responses; the field positions are fixed,
 * so parsing uses absolute indices rather than filtering blanks (a blank field
 * is meaningful and dropping it would silently shift every later column).
 *
 * Unofficial and best-effort: this is the feed eRail's own site uses, not an
 * IRCTC partner API.
 */
export declare class ErailProvider implements RailProvider {
    readonly name = "erail";
    readonly isLive = true;
    private readonly http;
    constructor(timeoutMs?: number);
    private fetchTrains;
    /** eRail has no station search endpoint; the chain falls back for this. */
    searchStations(query: string): Promise<Station[]>;
    getStation(): Promise<Station | null>;
    findTrainsBetweenStations(query: TrainsBetweenQuery): Promise<TrainBetweenStations[]>;
    getTrainSchedule(trainNumber: string): Promise<{
        train: Train;
        stops: ScheduleStop[];
    }>;
    getAvailability(query: AvailabilityQuery): Promise<Availability>;
    getFare(query: FareQuery): Promise<FareBreakdown>;
    getPnrStatus(pnr: string): Promise<PnrStatus>;
    getLiveTrainStatus(trainNumber: string): Promise<LiveTrainStatus>;
}
