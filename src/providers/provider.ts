import type {
  Availability,
  FareBreakdown,
  LiveTrainStatus,
  PnrStatus,
  Quota,
  ScheduleStop,
  Station,
  Train,
  TrainBetweenStations,
  TravelClass,
} from '../types.js';

export interface TrainsBetweenQuery {
  fromStationCode: string;
  toStationCode: string;
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Restrict to trains offering this class. */
  travelClass?: TravelClass;
}

export interface AvailabilityQuery {
  trainNumber: string;
  fromStationCode: string;
  toStationCode: string;
  date: string;
  travelClass: TravelClass;
  quota: Quota;
}

export interface FareQuery {
  trainNumber: string;
  fromStationCode: string;
  toStationCode: string;
  travelClass: TravelClass;
  quota: Quota;
  /**
   * ISO journey date. Live providers quote fares per date (dynamic pricing),
   * so they require it; the offline estimator ignores it.
   */
  date?: string;
  /** Concession category, where the provider supports it. */
  ageCategory?: 'adult' | 'child' | 'senior';
}

/**
 * The contract every backend implements.
 *
 * Adding a new data source means writing one class against this interface and
 * registering it in `providers/index.ts` — no tool code changes.
 */
export interface RailProvider {
  /** Short identifier surfaced to the model, e.g. "mock" or "rapidapi". */
  readonly name: string;

  /** True when the data is real-time from a live upstream service. */
  readonly isLive: boolean;

  /** Free-text search over station names and codes. */
  searchStations(query: string, limit: number): Promise<Station[]>;

  /** Resolve an exact station code. Returns null when unknown. */
  getStation(code: string): Promise<Station | null>;

  /** Trains connecting two stations on a given date. */
  findTrainsBetweenStations(query: TrainsBetweenQuery): Promise<TrainBetweenStations[]>;

  /** Full stop-by-stop schedule for a train. */
  getTrainSchedule(trainNumber: string): Promise<{ train: Train; stops: ScheduleStop[] }>;

  /** Seat/berth availability for one class and quota. */
  getAvailability(query: AvailabilityQuery): Promise<Availability>;

  /** Itemised fare for one class and quota. */
  getFare(query: FareQuery): Promise<FareBreakdown>;

  /** Current status of a 10 digit PNR. */
  getPnrStatus(pnr: string): Promise<PnrStatus>;

  /** Live running position and delay for a train. */
  getLiveTrainStatus(trainNumber: string, startDate: string): Promise<LiveTrainStatus>;
}
