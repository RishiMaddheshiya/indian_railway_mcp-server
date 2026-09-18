import {
  RailDataError,
  type Availability,
  type AvailabilityStatus,
  type FareBreakdown,
  type LiveStationUpdate,
  type LiveTrainStatus,
  type PnrPassenger,
  type PnrStatus,
  type Quota,
  type ScheduleStop,
  type Station,
  type Train,
  type TrainBetweenStations,
  type TravelClass,
} from '../types.js';
import { toMinutes, weekdayIndex } from '../util/dates.js';
import { computeFare } from '../util/fares.js';
import { MockProvider } from './mock.js';
import type {
  AvailabilityQuery,
  FareQuery,
  RailProvider,
  TrainsBetweenQuery,
} from './provider.js';

export interface RapidApiOptions {
  apiKey: string;
  /** RapidAPI host, defaults to the widely used `irctc1.p.rapidapi.com`. */
  host?: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
  /**
   * Fall back to the bundled dataset when the upstream call fails.
   * Useful for demos; off by default so failures stay visible.
   */
  fallbackToMock?: boolean;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Live provider backed by a RapidAPI Indian Railways gateway.
 *
 * The default host (`irctc1.p.rapidapi.com`) exposes the endpoints used
 * below. Other gateways differ; if you switch hosts you will likely need to
 * adjust the paths and the `normalise*` helpers, which is exactly why those
 * are isolated here rather than spread through the tool layer.
 *
 * Upstream responses are unofficial scrapes of public railway enquiry
 * services, not an IRCTC partner feed. Treat them as best-effort.
 */
export class RapidApiProvider implements RailProvider {
  readonly name = 'rapidapi';
  readonly isLive = true;

  private readonly apiKey: string;
  private readonly host: string;
  private readonly timeoutMs: number;
  private readonly fallbackToMock: boolean;
  private readonly fallback = new MockProvider();
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: RapidApiOptions) {
    if (!options.apiKey) {
      throw new Error('RapidApiProvider requires an apiKey');
    }
    this.apiKey = options.apiKey;
    this.host = options.host ?? 'irctc1.p.rapidapi.com';
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fallbackToMock = options.fallbackToMock ?? false;
  }

  // ---------------------------------------------------------------- transport

  private async request<T>(
    path: string,
    params: Record<string, string>,
    cacheTtlMs = 60_000,
  ): Promise<T> {
    const url = new URL(`https://${this.host}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const cacheKey = url.toString();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': this.host,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new RailDataError(
          'UPSTREAM_AUTH',
          'The rail data provider rejected the API key.',
          'Check IRCTC_RAPIDAPI_KEY and that your RapidAPI subscription covers this host.',
        );
      }
      if (response.status === 429) {
        throw new RailDataError(
          'RATE_LIMITED',
          'The rail data provider is rate limiting this key.',
          'Wait and retry, or upgrade the RapidAPI plan.',
        );
      }
      if (!response.ok) {
        throw new RailDataError(
          'UPSTREAM_ERROR',
          `Rail data provider returned HTTP ${response.status}.`,
        );
      }

      const body = (await response.json()) as { status?: boolean; message?: string; data?: unknown };

      if (body && body.status === false) {
        throw new RailDataError(
          'UPSTREAM_NO_DATA',
          typeof body.message === 'string' && body.message
            ? body.message
            : 'The rail data provider returned no data for this query.',
        );
      }

      const value = (body?.data ?? body) as T;
      this.cache.set(cacheKey, { value, expiresAt: Date.now() + cacheTtlMs });
      return value;
    } catch (error) {
      if (error instanceof RailDataError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RailDataError(
          'UPSTREAM_TIMEOUT',
          `Rail data provider did not respond within ${this.timeoutMs}ms.`,
        );
      }
      throw new RailDataError(
        'UPSTREAM_UNREACHABLE',
        `Could not reach the rail data provider: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Run `live`, optionally degrading to the bundled dataset on failure. */
  private async withFallback<T>(live: () => Promise<T>, offline: () => Promise<T>): Promise<T> {
    try {
      return await live();
    } catch (error) {
      if (this.fallbackToMock) {
        return offline();
      }
      throw error;
    }
  }

  // ------------------------------------------------------------------ methods

  async searchStations(query: string, limit: number): Promise<Station[]> {
    return this.withFallback(
      async () => {
        const data = await this.request<unknown[]>(
          '/api/v1/searchStation',
          { query },
          24 * 60 * 60 * 1000,
        );
        const stations = (Array.isArray(data) ? data : []).map(normaliseStation).filter(Boolean);
        return (stations as Station[]).slice(0, limit);
      },
      () => this.fallback.searchStations(query, limit),
    );
  }

  async getStation(code: string): Promise<Station | null> {
    const upper = code.trim().toUpperCase();
    const matches = await this.searchStations(upper, 10);
    return matches.find((s) => s.code === upper) ?? null;
  }

  async findTrainsBetweenStations(query: TrainsBetweenQuery): Promise<TrainBetweenStations[]> {
    return this.withFallback(
      async () => {
        const data = await this.request<Record<string, unknown>>(
          '/api/v3/trainBetweenStations',
          {
            fromStationCode: query.fromStationCode.toUpperCase(),
            toStationCode: query.toStationCode.toUpperCase(),
            dateOfJourney: query.date,
          },
          5 * 60 * 1000,
        );

        const rows = Array.isArray(data) ? data : ((data?.['data'] as unknown[]) ?? []);
        const results = (rows as Record<string, unknown>[])
          .map((row) => normaliseTrainBetween(row, query))
          .filter((r): r is TrainBetweenStations => r !== null);

        return query.travelClass
          ? results.filter((r) => r.train.classes.includes(query.travelClass as TravelClass))
          : results;
      },
      () => this.fallback.findTrainsBetweenStations(query),
    );
  }

  async getTrainSchedule(trainNumber: string): Promise<{ train: Train; stops: ScheduleStop[] }> {
    return this.withFallback(
      async () => {
        const data = await this.request<Record<string, unknown>>(
          '/api/v1/getTrainSchedule',
          { trainNo: trainNumber.trim() },
          60 * 60 * 1000,
        );
        return normaliseSchedule(trainNumber, data);
      },
      () => this.fallback.getTrainSchedule(trainNumber),
    );
  }

  async getAvailability(query: AvailabilityQuery): Promise<Availability> {
    return this.withFallback(
      async () => {
        const data = await this.request<Record<string, unknown>>(
          '/api/v1/checkSeatAvailability',
          {
            classType: query.travelClass,
            fromStationCode: query.fromStationCode.toUpperCase(),
            toStationCode: query.toStationCode.toUpperCase(),
            quota: query.quota,
            trainNo: query.trainNumber.trim(),
            date: query.date,
          },
          60 * 1000,
        );
        return normaliseAvailability(query, data);
      },
      () => this.fallback.getAvailability(query),
    );
  }

  async getFare(query: FareQuery): Promise<FareBreakdown> {
    return this.withFallback(
      async () => {
        const data = await this.request<Record<string, unknown>>(
          '/api/v2/getFare',
          {
            trainNo: query.trainNumber.trim(),
            fromStationCode: query.fromStationCode.toUpperCase(),
            toStationCode: query.toStationCode.toUpperCase(),
          },
          60 * 60 * 1000,
        );
        const normalised = normaliseFare(query, data);
        if (normalised) return normalised;
        // Upstream gave no usable figure for this class; estimate instead.
        return this.fallback.getFare(query);
      },
      () => this.fallback.getFare(query),
    );
  }

  async getPnrStatus(pnr: string): Promise<PnrStatus> {
    const clean = pnr.replace(/\D/g, '');
    if (clean.length !== 10) {
      throw new RailDataError('INVALID_PNR', 'A PNR must be exactly 10 digits.');
    }
    return this.withFallback(
      async () => {
        const data = await this.request<Record<string, unknown>>(
          '/api/v3/getPNRStatus',
          { pnrNumber: clean },
          60 * 1000,
        );
        return normalisePnr(clean, data);
      },
      () => this.fallback.getPnrStatus(clean),
    );
  }

  async getLiveTrainStatus(trainNumber: string, startDate: string): Promise<LiveTrainStatus> {
    return this.withFallback(
      async () => {
        const data = await this.request<Record<string, unknown>>(
          '/api/v1/liveTrainStatus',
          { trainNo: trainNumber.trim(), startDay: startDate },
          60 * 1000,
        );
        return normaliseLiveStatus(trainNumber, startDate, data);
      },
      () => this.fallback.getLiveTrainStatus(trainNumber, startDate),
    );
  }
}

// ------------------------------------------------------------- normalisers
//
// Upstream field names vary between gateway versions, so every accessor is
// defensive: pick the first key that exists, coerce, and fall back to a sane
// default rather than throwing deep inside a tool handler.

const str = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
};

const num = (row: Record<string, unknown>, ...keys: string[]): number => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
};

function normaliseStation(raw: unknown): Station | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const code = str(row, 'code', 'stationCode', 'station_code').toUpperCase();
  const name = str(row, 'name', 'stationName', 'station_name');
  if (!code) return null;
  const station: Station = { code, name: name || code };
  const state = str(row, 'state', 'stateName');
  if (state) station.state = state;
  return station;
}

function parseClasses(value: unknown): TravelClass[] {
  const valid = new Set(['1A', '2A', '3A', '3E', 'EC', 'CC', 'SL', '2S', 'FC']);
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];
  const out: TravelClass[] = [];
  for (const item of items) {
    const code = typeof item === 'string'
      ? item.trim().toUpperCase()
      : typeof item === 'object' && item !== null
        ? str(item as Record<string, unknown>, 'class', 'classType', 'code').toUpperCase()
        : '';
    if (valid.has(code) && !out.includes(code as TravelClass)) {
      out.push(code as TravelClass);
    }
  }
  return out;
}

function parseRunsOn(row: Record<string, unknown>): boolean[] {
  const keys = ['runMon', 'runTue', 'runWed', 'runThu', 'runFri', 'runSat', 'runSun'];
  const flags = keys.map((key) => {
    const value = row[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.trim().toUpperCase() === 'Y' || value === '1';
    if (typeof value === 'number') return value === 1;
    return false;
  });
  return flags.some(Boolean) ? flags : [true, true, true, true, true, true, true];
}

function normaliseTrainBetween(
  row: Record<string, unknown>,
  query: TrainsBetweenQuery,
): TrainBetweenStations | null {
  const number = str(row, 'train_number', 'trainNumber', 'trainNo');
  if (!number) return null;

  const name = str(row, 'train_name', 'trainName') || number;
  const departure = str(row, 'from_std', 'departureTime', 'departure') || '00:00';
  const arrival = str(row, 'to_sta', 'arrivalTime', 'arrival') || '00:00';
  const fromCode = (str(row, 'from_station_code', 'fromStationCode') || query.fromStationCode).toUpperCase();
  const toCode = (str(row, 'to_station_code', 'toStationCode') || query.toStationCode).toUpperCase();

  const durationRaw = str(row, 'duration', 'travelTime');
  let durationMinutes = 0;
  const durationMatch = durationRaw.match(/(\d+)\s*[:hH]\s*(\d+)/);
  if (durationMatch?.[1] && durationMatch[2]) {
    durationMinutes = Number(durationMatch[1]) * 60 + Number(durationMatch[2]);
  } else {
    durationMinutes = toMinutes(arrival) - toMinutes(departure);
    if (durationMinutes < 0) durationMinutes += 1440;
  }

  const runsOn = parseRunsOn(row);
  const classes = parseClasses(row['class_type'] ?? row['classes'] ?? row['classType']);
  const arrivalDayOffset = Math.floor((toMinutes(departure) + durationMinutes) / 1440);

  const train: Train = {
    number,
    name,
    type: str(row, 'train_type', 'trainType') || 'Express',
    fromStationCode: (str(row, 'train_src', 'source') || fromCode).toUpperCase(),
    fromStationName: str(row, 'from_station_name', 'fromStationName') || fromCode,
    toStationCode: (str(row, 'train_dstn', 'destination') || toCode).toUpperCase(),
    toStationName: str(row, 'to_station_name', 'toStationName') || toCode,
    runsOn,
    classes: classes.length > 0 ? classes : (['SL', '3A', '2A'] as TravelClass[]),
  };

  return {
    train,
    fromStationCode: fromCode,
    fromStationName: train.fromStationName,
    toStationCode: toCode,
    toStationName: train.toStationName,
    departure,
    arrival,
    durationMinutes,
    distanceKm: num(row, 'distance', 'distanceKm'),
    runsOnDate: runsOn[weekdayIndex(query.date)] ?? true,
    arrivalDayOffset,
  };
}

function normaliseSchedule(
  trainNumber: string,
  data: Record<string, unknown>,
): { train: Train; stops: ScheduleStop[] } {
  const rows = (data['route'] ?? data['stations'] ?? data['data'] ?? []) as Record<string, unknown>[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new RailDataError(
      'NO_SCHEDULE',
      `No schedule returned for train ${trainNumber}.`,
    );
  }

  const stops: ScheduleStop[] = rows.map((row, index) => {
    const arrival = str(row, 'arrivalTime', 'arrival', 'sta');
    const departure = str(row, 'departureTime', 'departure', 'std');
    const clean = (t: string): string | null =>
      !t || t === '--' || t === '00:00:00' || t.toLowerCase() === 'source' || t.toLowerCase() === 'destination'
        ? null
        : t.slice(0, 5);
    return {
      stationCode: str(row, 'stationCode', 'station_code', 'code').toUpperCase(),
      stationName: str(row, 'stationName', 'station_name', 'name'),
      arrival: index === 0 ? null : clean(arrival),
      departure: index === rows.length - 1 ? null : clean(departure),
      haltMinutes: num(row, 'haltTime', 'halt', 'stopTime'),
      distanceKm: num(row, 'distance', 'distanceFromSource'),
      day: num(row, 'dayCount', 'day') || 1,
      platform: str(row, 'platform', 'platformNumber') || null,
    };
  });

  const first = stops[0];
  const last = stops[stops.length - 1];

  const train: Train = {
    number: trainNumber,
    name: str(data, 'train_name', 'trainName') || trainNumber,
    type: str(data, 'train_type', 'trainType') || 'Express',
    fromStationCode: first?.stationCode ?? '',
    fromStationName: first?.stationName ?? '',
    toStationCode: last?.stationCode ?? '',
    toStationName: last?.stationName ?? '',
    runsOn: parseRunsOn(data),
    classes: parseClasses(data['class_type'] ?? data['classes']),
  };

  return { train, stops };
}

function classifyAvailability(text: string): { status: AvailabilityStatus; count?: number } {
  const upper = text.toUpperCase();
  if (upper.includes('AVAILABLE')) {
    const match = upper.match(/AVAILABLE[- ]*(\d+)/);
    const result: { status: AvailabilityStatus; count?: number } = { status: 'AVAILABLE' };
    if (match?.[1]) result.count = Number(match[1]);
    return result;
  }
  if (upper.includes('RAC')) {
    const match = upper.match(/RAC[\s/]*(\d+)/);
    const result: { status: AvailabilityStatus; count?: number } = { status: 'RAC' };
    if (match?.[1]) result.count = Number(match[1]);
    return result;
  }
  if (upper.includes('REGRET') || upper.includes('NOT AVAILABLE')) return { status: 'REGRET' };
  if (upper.includes('WL')) {
    const match = upper.match(/WL[\s/]*(\d+)/);
    const result: { status: AvailabilityStatus; count?: number } = { status: 'WAITLIST' };
    if (match?.[1]) result.count = Number(match[1]);
    return result;
  }
  if (upper.includes('CHART')) return { status: 'CHART_PREPARED' };
  return { status: 'NOT_APPLICABLE' };
}

function normaliseAvailability(
  query: AvailabilityQuery,
  data: Record<string, unknown>,
): Availability {
  const rows = Array.isArray(data) ? data : ((data['data'] as unknown[]) ?? []);
  const first = (rows as Record<string, unknown>[]).find((row) => {
    const date = str(row, 'date', 'journeyDate');
    return !date || date.includes(query.date.slice(8)) || date === query.date;
  }) ?? (rows as Record<string, unknown>[])[0];

  const statusText = first
    ? str(first, 'current_status', 'currentStatus', 'availablity_status', 'status')
    : str(data, 'current_status', 'status');

  if (!statusText) {
    throw new RailDataError(
      'NO_AVAILABILITY',
      `No availability returned for train ${query.trainNumber} in ${query.travelClass} on ${query.date}.`,
    );
  }

  const { status, count } = classifyAvailability(statusText);
  const result: Availability = {
    trainNumber: query.trainNumber,
    travelClass: query.travelClass,
    quota: query.quota,
    date: query.date,
    status,
    statusText,
  };
  if (count !== undefined) result.count = count;

  const chance = first ? num(first, 'confirm_probability', 'confirmTktStatus') : 0;
  if (chance > 0) result.confirmationChance = Math.min(1, chance / 100);

  return result;
}

function normaliseFare(
  query: FareQuery,
  data: Record<string, unknown>,
): FareBreakdown | null {
  const general = (data['general'] ?? data['fare'] ?? data['data']) as unknown;
  const rows = Array.isArray(general) ? (general as Record<string, unknown>[]) : [];
  const match = rows.find(
    (row) => str(row, 'classType', 'class_type', 'class').toUpperCase() === query.travelClass,
  );
  if (!match) return null;

  const total = num(match, 'totalFare', 'fare', 'total_fare');
  if (total <= 0) return null;

  const distanceKm = num(data, 'distance', 'distanceKm');
  const reservationCharge = num(match, 'reservationCharge');
  const superfastCharge = num(match, 'superfastCharge');
  const gst = num(match, 'gst', 'serviceTax');
  const cateringCharge = num(match, 'cateringCharge');
  const dynamicSurcharge = num(match, 'dynamicFare', 'flexiFare');
  const baseFare =
    num(match, 'baseFare') ||
    Math.max(
      0,
      total - reservationCharge - superfastCharge - gst - cateringCharge - dynamicSurcharge,
    );

  return {
    trainNumber: query.trainNumber,
    travelClass: query.travelClass,
    quota: query.quota,
    fromStationCode: query.fromStationCode.toUpperCase(),
    toStationCode: query.toStationCode.toUpperCase(),
    distanceKm,
    baseFare,
    reservationCharge,
    superfastCharge,
    gst,
    cateringCharge,
    dynamicSurcharge,
    totalFare: total,
    currency: 'INR',
  };
}

function normalisePnr(pnr: string, data: Record<string, unknown>): PnrStatus {
  const passengerRows = (data['passengerList'] ?? data['passengers'] ?? []) as Record<string, unknown>[];

  const passengers: PnrPassenger[] = (Array.isArray(passengerRows) ? passengerRows : []).map(
    (row, index) => {
      const current =
        str(row, 'currentStatus', 'current_status') ||
        str(row, 'currentStatusDetails', 'current_status_details') ||
        'UNKNOWN';
      const entry: PnrPassenger = {
        serial: num(row, 'passengerSerialNumber') || index + 1,
        bookingStatus:
          str(row, 'bookingStatus', 'booking_status', 'bookingStatusDetails') || current,
        currentStatus: current,
      };
      const coach = str(row, 'currentCoachId', 'coachId', 'coach');
      const berth = str(row, 'currentBerthNo', 'berthNo', 'berth');
      const berthType = str(row, 'currentBerthCode', 'berthCode', 'berthType');
      if (coach) entry.coach = coach;
      if (berth) entry.berth = berth;
      if (berthType) entry.berthType = berthType;
      return entry;
    },
  );

  if (passengers.length === 0) {
    throw new RailDataError(
      'PNR_NOT_FOUND',
      `No booking found for PNR ${pnr}.`,
      'PNRs are purged a few days after the journey date.',
    );
  }

  const rawDate = str(data, 'dateOfJourney', 'journeyDate', 'doj');
  const journeyDate = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : rawDate;

  const travelClass = (str(data, 'journeyClass', 'class') || 'SL').toUpperCase() as TravelClass;
  const quota = (str(data, 'quota', 'quotaCode') || 'GN').toUpperCase() as Quota;

  const result: PnrStatus = {
    pnr,
    trainNumber: str(data, 'trainNumber', 'trainNo'),
    trainName: str(data, 'trainName', 'train_name'),
    journeyDate,
    fromStationCode: str(data, 'sourceStation', 'fromStation', 'boardingPoint').toUpperCase(),
    fromStationName: str(data, 'sourceStationName', 'fromStationName'),
    toStationCode: str(data, 'destinationStation', 'toStation', 'reservationUpto').toUpperCase(),
    toStationName: str(data, 'destinationStationName', 'toStationName'),
    boardingStationCode: str(data, 'boardingPoint', 'boardingStation').toUpperCase(),
    reservedUpto: str(data, 'reservationUpto', 'destinationStation').toUpperCase(),
    travelClass,
    quota,
    chartPrepared: data['chartPrepared'] === true || str(data, 'chartStatus').toUpperCase().includes('PREPARED'),
    passengers,
  };

  const bookingFare = num(data, 'bookingFare');
  const ticketFare = num(data, 'ticketFare');
  if (bookingFare) result.bookingFare = bookingFare;
  if (ticketFare) result.ticketFare = ticketFare;

  return result;
}

function normaliseLiveStatus(
  trainNumber: string,
  startDate: string,
  data: Record<string, unknown>,
): LiveTrainStatus {
  const rows = (data['upcoming_stations'] ?? data['route'] ?? data['stations'] ?? []) as Record<
    string,
    unknown
  >[];

  const toUpdate = (row: Record<string, unknown>, departed: boolean): LiveStationUpdate => {
    const clean = (t: string): string | null => (!t || t === '--' ? null : t.slice(0, 5));
    return {
      stationCode: str(row, 'stationCode', 'station_code').toUpperCase(),
      stationName: str(row, 'stationName', 'station_name'),
      scheduledArrival: clean(str(row, 'sta', 'scheduledArrival', 'arrivalTime')),
      actualArrival: clean(str(row, 'eta', 'actualArrival')),
      scheduledDeparture: clean(str(row, 'std', 'scheduledDeparture', 'departureTime')),
      actualDeparture: clean(str(row, 'etd', 'actualDeparture')),
      delayMinutes: num(row, 'arrivalDelay', 'delay', 'delayInMinutes'),
      distanceKm: num(row, 'distance', 'distanceFromSource'),
      day: num(row, 'dayCount', 'day') || 1,
      platform: str(row, 'platform_number', 'platform') || null,
      hasDeparted: departed,
      hasArrived: departed,
    };
  };

  const upcoming = (Array.isArray(rows) ? rows : []).map((row) => toUpdate(row, false));
  const passedRows = (data['passed_stations'] ?? []) as Record<string, unknown>[];
  const passed = (Array.isArray(passedRows) ? passedRows : []).map((row) => toUpdate(row, true));

  const delayMinutes = num(data, 'delay', 'delayInMinutes', 'arrivalDelay');
  const currentStationName =
    str(data, 'current_station_name', 'currentStationName') || passed[passed.length - 1]?.stationName || null;
  const currentStationCode =
    str(data, 'current_station_code', 'currentStationCode').toUpperCase() ||
    passed[passed.length - 1]?.stationCode ||
    null;

  return {
    trainNumber,
    trainName: str(data, 'train_name', 'trainName') || trainNumber,
    startDate,
    position: str(data, 'current_location_description', 'position', 'status') ||
      (currentStationName ? `Near ${currentStationName}` : 'Position unavailable'),
    currentStationCode: currentStationCode || null,
    currentStationName: currentStationName || null,
    delayMinutes,
    updatedAt: new Date().toISOString(),
    upcomingStations: upcoming,
    passedStations: passed,
    journeyCompleted: data['train_status_message'] === 'Journey Completed' || upcoming.length === 0,
  };
}

/** Exported for the fare estimator used when upstream omits a class. */
export { computeFare };
