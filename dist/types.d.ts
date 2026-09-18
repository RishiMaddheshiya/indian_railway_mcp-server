/**
 * Domain types for Indian Railways / IRCTC data.
 *
 * These are provider-agnostic: every provider (mock, RapidAPI, a private
 * IRCTC partner API) normalises its own wire format into these shapes so the
 * MCP tools never have to care where the data came from.
 */
/** Reserved travel classes used by Indian Railways. */
export declare const TRAVEL_CLASSES: {
    readonly '1A': "AC First Class";
    readonly '2A': "AC 2 Tier";
    readonly '3A': "AC 3 Tier";
    readonly '3E': "AC 3 Tier (Economy)";
    readonly EC: "Executive Chair Car";
    readonly CC: "AC Chair Car";
    readonly SL: "Sleeper Class";
    readonly '2S': "Second Sitting";
    readonly FC: "First Class (non-AC)";
};
export type TravelClass = keyof typeof TRAVEL_CLASSES;
/** Booking quotas. GN (General) is the default for ordinary bookings. */
export declare const QUOTAS: {
    readonly GN: "General";
    readonly TQ: "Tatkal";
    readonly PT: "Premium Tatkal";
    readonly LD: "Ladies";
    readonly SS: "Senior Citizen / Lower berth";
    readonly HP: "Divyaangjan (handicapped)";
    readonly DF: "Defence";
    readonly FT: "Foreign Tourist";
};
export type Quota = keyof typeof QUOTAS;
export interface Station {
    /** Station code, e.g. "NDLS". Always upper case. */
    code: string;
    /** Human readable name, e.g. "New Delhi". */
    name: string;
    /** State or union territory. */
    state?: string;
    /** Zone abbreviation, e.g. "NR". */
    zone?: string;
    /** Latitude in decimal degrees. */
    lat?: number;
    /** Longitude in decimal degrees. */
    lon?: number;
}
/** One stop on a train's schedule. */
export interface ScheduleStop {
    stationCode: string;
    stationName: string;
    /** Arrival in 24h "HH:mm". Null at the originating station. */
    arrival: string | null;
    /** Departure in 24h "HH:mm". Null at the terminating station. */
    departure: string | null;
    /** Halt duration in minutes. 0 at origin and destination. */
    haltMinutes: number;
    /** Kilometres from the train's origin. */
    distanceKm: number;
    /** Day of the journey this stop falls on. The origin is day 1. */
    day: number;
    /** Platform number when known. */
    platform?: string | null;
}
export interface Train {
    /** Five digit train number, e.g. "12951". */
    number: string;
    /** Train name, e.g. "Mumbai Rajdhani Express". */
    name: string;
    /** Type, e.g. "Rajdhani", "Vande Bharat", "Superfast", "Express". */
    type: string;
    fromStationCode: string;
    fromStationName: string;
    toStationCode: string;
    toStationName: string;
    /** Days of the week the train runs, index 0 = Monday. */
    runsOn: boolean[];
    /** Classes available on this train. */
    classes: TravelClass[];
    /** Whether the train has a pantry car. */
    hasPantry?: boolean;
}
/** A train matched against a specific origin/destination pair. */
export interface TrainBetweenStations {
    train: Train;
    fromStationCode: string;
    fromStationName: string;
    toStationCode: string;
    toStationName: string;
    /** Departure from the requested origin, "HH:mm". */
    departure: string;
    /** Arrival at the requested destination, "HH:mm". */
    arrival: string;
    /** Total journey duration in minutes for this leg. */
    durationMinutes: number;
    /** Distance for this leg in kilometres. */
    distanceKm: number;
    /** Whether the train runs on the requested date. */
    runsOnDate: boolean;
    /** Day offset of arrival relative to departure (0 = same day). */
    arrivalDayOffset: number;
}
export type AvailabilityStatus = 'AVAILABLE' | 'RAC' | 'WAITLIST' | 'REGRET' | 'CHART_PREPARED' | 'NOT_APPLICABLE';
export interface Availability {
    trainNumber: string;
    travelClass: TravelClass;
    quota: Quota;
    /** ISO date "YYYY-MM-DD" of the journey. */
    date: string;
    status: AvailabilityStatus;
    /** Raw status string as railways would print it, e.g. "AVAILABLE-0042", "WL 18". */
    statusText: string;
    /** Berths free, or waitlist position, depending on `status`. */
    count?: number;
    /** Rough chance of confirmation (0..1) where the provider offers a prediction. */
    confirmationChance?: number;
}
export interface FareBreakdown {
    trainNumber: string;
    travelClass: TravelClass;
    quota: Quota;
    fromStationCode: string;
    toStationCode: string;
    distanceKm: number;
    /** All amounts in INR. */
    baseFare: number;
    reservationCharge: number;
    superfastCharge: number;
    gst: number;
    cateringCharge: number;
    dynamicSurcharge: number;
    totalFare: number;
    currency: 'INR';
}
export interface PnrPassenger {
    serial: number;
    bookingStatus: string;
    currentStatus: string;
    coach?: string | null;
    berth?: string | null;
    berthType?: string | null;
}
export interface PnrStatus {
    pnr: string;
    trainNumber: string;
    trainName: string;
    /** ISO date "YYYY-MM-DD". */
    journeyDate: string;
    fromStationCode: string;
    fromStationName: string;
    toStationCode: string;
    toStationName: string;
    boardingStationCode: string;
    reservedUpto: string;
    travelClass: TravelClass;
    quota: Quota;
    chartPrepared: boolean;
    passengers: PnrPassenger[];
    bookingFare?: number;
    ticketFare?: number;
}
export interface LiveStationUpdate {
    stationCode: string;
    stationName: string;
    scheduledArrival: string | null;
    actualArrival: string | null;
    scheduledDeparture: string | null;
    actualDeparture: string | null;
    /** Positive = late, negative = early, in minutes. */
    delayMinutes: number;
    distanceKm: number;
    day: number;
    platform?: string | null;
    hasDeparted: boolean;
    hasArrived: boolean;
}
export interface LiveTrainStatus {
    trainNumber: string;
    trainName: string;
    /** ISO date "YYYY-MM-DD" the train started its run. */
    startDate: string;
    /** Free-text position summary. */
    position: string;
    currentStationCode: string | null;
    currentStationName: string | null;
    /** Positive = running late, in minutes. */
    delayMinutes: number;
    /** ISO 8601 timestamp of when this status was generated. */
    updatedAt: string;
    upcomingStations: LiveStationUpdate[];
    passedStations: LiveStationUpdate[];
    /** True when the run has finished. */
    journeyCompleted: boolean;
}
/** Thrown by providers for user-actionable failures (bad code, no data, etc). */
export declare class RailDataError extends Error {
    readonly code: string;
    readonly hint?: string;
    constructor(code: string, message: string, hint?: string);
}
