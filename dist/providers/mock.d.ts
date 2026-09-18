import { type Availability, type FareBreakdown, type LiveTrainStatus, type PnrStatus, type ScheduleStop, type Station, type Train, type TrainBetweenStations } from '../types.js';
import type { AvailabilityQuery, FareQuery, RailProvider, TrainsBetweenQuery } from './provider.js';
/**
 * Offline provider backed by the bundled sample timetable.
 *
 * Every answer is deterministic for a given query, so repeated calls inside
 * one conversation stay consistent. Live-only facts (availability, PNR,
 * running status) are synthesised and clearly labelled as such by the tool
 * layer.
 */
export declare class MockProvider implements RailProvider {
    readonly name = "mock";
    readonly isLive = false;
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
