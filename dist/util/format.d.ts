import { type Availability, type FareBreakdown, type LiveTrainStatus, type PnrStatus, type ScheduleStop, type Station, type Train, type TrainBetweenStations } from '../types.js';
export declare const rupees: (amount: number) => string;
export declare function className(code: string): string;
export declare function quotaName(code: string): string;
export declare function runDays(runsOn: boolean[]): string;
/** Render a simple markdown table. */
export declare function table(headers: string[], rows: string[][]): string;
export declare function formatStations(stations: Station[]): string;
export declare function formatTrainsBetween(results: TrainBetweenStations[], date: string): string;
export declare function formatSchedule(train: Train, stops: ScheduleStop[]): string;
export declare function formatAvailability(a: Availability): string;
export declare function formatFare(f: FareBreakdown): string;
export declare function formatPnr(p: PnrStatus): string;
export declare function formatLiveStatus(s: LiveTrainStatus, upcomingLimit?: number): string;
