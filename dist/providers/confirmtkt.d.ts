import { type Availability, type AvailabilityStatus, type FareBreakdown, type LiveTrainStatus, type PnrStatus, type ScheduleStop, type Station, type Train, type TrainBetweenStations } from '../types.js';
import type { AvailabilityQuery, FareQuery, RailProvider, TrainsBetweenQuery } from './provider.js';
/**
 * Live provider backed by ConfirmTkt's public trains API. No API key needed.
 *
 * One `trains/search` call returns the train list *together with* live seat
 * availability, quoted fares and confirmation predictions, so trains-between,
 * availability and fare all resolve from a single cached upstream request.
 *
 * This is an unofficial endpoint used by their own web frontend. It is not an
 * IRCTC partner feed, it can change without notice, and it should be treated
 * as best-effort rather than authoritative.
 */
export declare class ConfirmTktProvider implements RailProvider {
    readonly name = "confirmtkt";
    readonly isLive = true;
    private readonly http;
    constructor(timeoutMs?: number);
    private search;
    searchStations(query: string, limit: number): Promise<Station[]>;
    getStation(code: string): Promise<Station | null>;
    findTrainsBetweenStations(query: TrainsBetweenQuery): Promise<TrainBetweenStations[]>;
    private toTrainBetween;
    /** ConfirmTkt has no route endpoint; the chain falls back to eRail for this. */
    getTrainSchedule(trainNumber: string): Promise<{
        train: Train;
        stops: ScheduleStop[];
    }>;
    /** Locate one class in the availability cache for a train on a route/date. */
    private findClassEntry;
    getAvailability(query: AvailabilityQuery): Promise<Availability>;
    getFare(query: FareQuery): Promise<FareBreakdown>;
    getPnrStatus(pnr: string): Promise<PnrStatus>;
    /** Not offered by this provider; the chain falls through to a keyed one. */
    getLiveTrainStatus(trainNumber: string): Promise<LiveTrainStatus>;
}
export declare function classifyAvailability(text: string): {
    status: AvailabilityStatus;
    count?: number;
};
