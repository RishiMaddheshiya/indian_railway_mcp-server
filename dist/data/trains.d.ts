import type { ScheduleStop, Train } from '../types.js';
export interface TrainRecord {
    train: Train;
    stops: ScheduleStop[];
}
/**
 * Sample timetable data for the offline `mock` provider.
 *
 * Timings, halts and distances are approximate and are NOT an authoritative
 * timetable — switch to a live provider for anything you will act on.
 */
export declare const TRAINS: TrainRecord[];
export declare const TRAIN_BY_NUMBER: Map<string, TrainRecord>;
