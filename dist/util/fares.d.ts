import type { FareBreakdown, Quota, TravelClass } from '../types.js';
export interface FareInput {
    trainNumber: string;
    trainType: string;
    travelClass: TravelClass;
    quota: Quota;
    fromStationCode: string;
    toStationCode: string;
    distanceKm: number;
    ageCategory?: 'adult' | 'child' | 'senior';
}
export declare function computeFare(input: FareInput): FareBreakdown;
