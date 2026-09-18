import { type Availability, type FareBreakdown, type LiveTrainStatus, type PnrStatus, type ScheduleStop, type Station, type Train, type TrainBetweenStations } from '../types.js';
import type { RailProvider } from './provider.js';
/**
 * Station lookup only, from the bundled directory.
 *
 * This sits at the end of the live chain on purpose. Station codes and names
 * are static reference data — NDLS is New Delhi whether or not the network is
 * up — so answering them offline is accurate rather than misleading. It
 * deliberately refuses everything volatile (availability, fares, PNR, running
 * status), which must never be served from stale local data.
 */
export declare class StationDirectoryProvider implements RailProvider {
    readonly name = "station-directory";
    readonly isLive = false;
    searchStations(query: string, limit: number): Promise<Station[]>;
    getStation(code: string): Promise<Station | null>;
    findTrainsBetweenStations(): Promise<TrainBetweenStations[]>;
    getTrainSchedule(): Promise<{
        train: Train;
        stops: ScheduleStop[];
    }>;
    getAvailability(): Promise<Availability>;
    getFare(): Promise<FareBreakdown>;
    getPnrStatus(): Promise<PnrStatus>;
    getLiveTrainStatus(): Promise<LiveTrainStatus>;
}
