import {
  RailDataError,
  type Availability,
  type AvailabilityStatus,
  type FareBreakdown,
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
import { HttpClient, toDdMmYyyy } from '../util/http.js';
import type {
  AvailabilityQuery,
  FareQuery,
  RailProvider,
  TrainsBetweenQuery,
} from './provider.js';

const API_HOST = 'https://cttrainsapi.confirmtkt.com';
const WEB_HOST = 'https://www.confirmtkt.com';

/**
 * Public constants the ConfirmTkt web frontend sends on every call. The
 * `apikey` is `${clientid}!2$` hard-coded in their public JS bundle — it is a
 * client identifier, not a per-user secret, and no account is involved.
 */
const API_HEADERS: Record<string, string> = {
  Accept: 'application/json',
  clientid: 'ct-web',
  apikey: 'ct-web!2$',
  deviceid: 'irctc-mcp-0000-0000-0000-000000000000',
};

interface CtAvailabilityEntry {
  availability?: string;
  availabilityDisplayName?: string;
  fare?: string | number;
  confirmTktStatus?: string;
  predictionPercentage?: number | string;
  prediction?: string;
  quota?: string;
  travelClass?: string;
}

interface CtTrain {
  trainNumber?: string;
  trainName?: string;
  fromStnCode?: string;
  fromStnName?: string;
  toStnCode?: string;
  toStnName?: string;
  departureTime?: string;
  arrivalTime?: string;
  duration?: number | string;
  distance?: number | string;
  runningDays?: string;
  hasPantry?: boolean;
  trainType?: string;
  avlClasses?: string[];
  availabilityCache?: Record<string, CtAvailabilityEntry>;
}

interface CtStation {
  stationCode?: string;
  stationName?: string;
  city?: string;
  state?: string;
  majorStn?: boolean;
}

const VALID_CLASSES = new Set<string>(['1A', '2A', '3A', '3E', 'EC', 'CC', 'SL', '2S', 'FC']);

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
export class ConfirmTktProvider implements RailProvider {
  readonly name = 'confirmtkt';
  readonly isLive = true;

  private readonly http: HttpClient;

  constructor(timeoutMs = 15_000) {
    this.http = new HttpClient(timeoutMs);
  }

  // ----------------------------------------------------------------- search

  private async search(
    fromCode: string,
    toCode: string,
    isoDate: string,
  ): Promise<CtTrain[]> {
    const url =
      `${API_HOST}/api/v1/trains/search` +
      `?sourceStationCode=${encodeURIComponent(fromCode)}` +
      `&destinationStationCode=${encodeURIComponent(toCode)}` +
      `&dateOfJourney=${encodeURIComponent(toDdMmYyyy(isoDate))}`;

    const json = await this.http.getJson<{
      data?: { trainList?: CtTrain[] };
      error?: { message?: string; code?: string };
    }>(url, { headers: API_HEADERS, cacheTtlMs: 60_000, label: 'ConfirmTkt' });

    if (json.error) {
      throw new RailDataError(
        'UPSTREAM_NO_DATA',
        `ConfirmTkt: ${json.error.message ?? json.error.code ?? 'request rejected'}`,
      );
    }

    return json.data?.trainList ?? [];
  }

  async searchStations(query: string, limit: number): Promise<Station[]> {
    const url =
      `${API_HOST}/api/v2/trains/stations/auto-suggestion` +
      `?searchString=${encodeURIComponent(query.trim())}` +
      `&sourceStnCode=&popularStnListLimit=15&preferredStnListLimit=6` +
      `&channel=mwebd&language=EN`;

    const json = await this.http.getJson<{ data?: { stationList?: CtStation[] } }>(url, {
      headers: API_HEADERS,
      cacheTtlMs: 12 * 60 * 60 * 1000,
      label: 'ConfirmTkt station search',
    });

    const list = json.data?.stationList ?? [];
    if (list.length === 0) {
      throw new RailDataError('NO_STATIONS', `ConfirmTkt returned no stations for "${query}".`);
    }

    return list
      .filter((s) => s.stationCode)
      .slice(0, limit)
      .map((s) => {
        const station: Station = {
          code: String(s.stationCode).toUpperCase(),
          name: s.stationName ?? String(s.stationCode),
        };
        if (s.state) station.state = s.state;
        return station;
      });
  }

  async getStation(code: string): Promise<Station | null> {
    const upper = code.trim().toUpperCase();
    const matches = await this.searchStations(upper, 12);
    return matches.find((s) => s.code === upper) ?? null;
  }

  async findTrainsBetweenStations(query: TrainsBetweenQuery): Promise<TrainBetweenStations[]> {
    const from = query.fromStationCode.toUpperCase();
    const to = query.toStationCode.toUpperCase();
    if (from === to) {
      throw new RailDataError('SAME_STATION', 'Origin and destination are the same station.');
    }

    const list = await this.search(from, to, query.date);
    const results = list
      .map((t) => this.toTrainBetween(t, query, from, to))
      .filter((r): r is TrainBetweenStations => r !== null);

    return query.travelClass
      ? results.filter((r) => r.train.classes.includes(query.travelClass as TravelClass))
      : results;
  }

  private toTrainBetween(
    t: CtTrain,
    query: TrainsBetweenQuery,
    fromCode: string,
    toCode: string,
  ): TrainBetweenStations | null {
    if (!t.trainNumber) return null;

    const departure = normaliseClock(t.departureTime) ?? '00:00';
    const arrival = normaliseClock(t.arrivalTime) ?? '00:00';

    let durationMinutes = Number(t.duration);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      durationMinutes = toMinutes(arrival) - toMinutes(departure);
      if (durationMinutes < 0) durationMinutes += 1440;
    }

    const classes = (t.avlClasses ?? Object.keys(t.availabilityCache ?? {}))
      .map((c) => String(c).toUpperCase())
      .filter((c) => VALID_CLASSES.has(c)) as TravelClass[];

    const runsOn = parseRunningDays(t.runningDays);

    const train: Train = {
      number: String(t.trainNumber),
      name: t.trainName ?? String(t.trainNumber),
      type: t.trainType ?? 'Express',
      fromStationCode: (t.fromStnCode ?? fromCode).toUpperCase(),
      fromStationName: t.fromStnName ?? fromCode,
      toStationCode: (t.toStnCode ?? toCode).toUpperCase(),
      toStationName: t.toStnName ?? toCode,
      runsOn,
      classes: classes.length > 0 ? classes : (['SL'] as TravelClass[]),
      hasPantry: t.hasPantry ?? false,
    };

    return {
      train,
      fromStationCode: (t.fromStnCode ?? fromCode).toUpperCase(),
      fromStationName: t.fromStnName ?? fromCode,
      toStationCode: (t.toStnCode ?? toCode).toUpperCase(),
      toStationName: t.toStnName ?? toCode,
      departure,
      arrival,
      durationMinutes,
      distanceKm: Number(t.distance) || 0,
      runsOnDate: runsOn[weekdayIndex(query.date)] ?? true,
      arrivalDayOffset: Math.floor((toMinutes(departure) + durationMinutes) / 1440),
    };
  }

  /** ConfirmTkt has no route endpoint; the chain falls back to eRail for this. */
  async getTrainSchedule(trainNumber: string): Promise<{ train: Train; stops: ScheduleStop[] }> {
    throw new RailDataError(
      'NOT_SUPPORTED',
      `ConfirmTkt does not expose a stop-by-stop schedule for train ${trainNumber}.`,
    );
  }

  // ----------------------------------------------- availability and fares

  /** Locate one class in the availability cache for a train on a route/date. */
  private async findClassEntry(
    trainNumber: string,
    fromCode: string,
    toCode: string,
    isoDate: string,
    travelClass: TravelClass,
  ): Promise<{ entry: CtAvailabilityEntry; train: CtTrain }> {
    const list = await this.search(fromCode.toUpperCase(), toCode.toUpperCase(), isoDate);
    const train = list.find((t) => String(t.trainNumber) === trainNumber.trim());

    if (!train) {
      throw new RailDataError(
        'TRAIN_NOT_ON_ROUTE',
        `Train ${trainNumber} does not run between ${fromCode.toUpperCase()} and ${toCode.toUpperCase()} on ${isoDate}.`,
        list.length > 0
          ? `Trains on this route: ${list.slice(0, 8).map((t) => t.trainNumber).join(', ')}.`
          : 'No trains at all were returned for this pair and date.',
      );
    }

    const cache = train.availabilityCache ?? {};
    const entry = cache[travelClass];
    if (!entry) {
      const offered = Object.keys(cache).join(', ') || (train.avlClasses ?? []).join(', ');
      throw new RailDataError(
        'CLASS_NOT_AVAILABLE',
        `Train ${trainNumber} has no ${travelClass} availability on this route.`,
        offered ? `Classes offered: ${offered}.` : undefined,
      );
    }

    return { entry, train };
  }

  async getAvailability(query: AvailabilityQuery): Promise<Availability> {
    const { entry } = await this.findClassEntry(
      query.trainNumber,
      query.fromStationCode,
      query.toStationCode,
      query.date,
      query.travelClass,
    );

    const statusText =
      entry.availabilityDisplayName?.trim() || entry.availability?.trim() || 'UNKNOWN';
    const { status, count } = classifyAvailability(
      `${entry.availability ?? ''} ${statusText}`,
    );

    const result: Availability = {
      trainNumber: query.trainNumber,
      travelClass: query.travelClass,
      quota: (entry.quota?.toUpperCase() as Quota) || query.quota,
      date: query.date,
      status,
      statusText,
    };
    if (count !== undefined) result.count = count;

    const pct = Number(entry.predictionPercentage);
    if (Number.isFinite(pct) && pct > 0) {
      result.confirmationChance = Math.min(1, pct / 100);
    } else if (status === 'AVAILABLE') {
      result.confirmationChance = 1;
    }

    return result;
  }

  async getFare(query: FareQuery): Promise<FareBreakdown> {
    if (!query.date) {
      throw new RailDataError(
        'DATE_REQUIRED',
        'ConfirmTkt quotes fares per journey date; no date was supplied.',
      );
    }

    const { entry } = await this.findClassEntry(
      query.trainNumber,
      query.fromStationCode,
      query.toStationCode,
      query.date,
      query.travelClass,
    );

    const total = Number(entry.fare);
    if (!Number.isFinite(total) || total <= 0) {
      throw new RailDataError(
        'NO_FARE',
        `ConfirmTkt did not quote a ${query.travelClass} fare for train ${query.trainNumber}.`,
      );
    }

    // The upstream quotes one all-in fare with no component breakdown, so the
    // components stay zero and the formatter prints a single total.
    return {
      trainNumber: query.trainNumber,
      travelClass: query.travelClass,
      quota: (entry.quota?.toUpperCase() as Quota) || query.quota,
      fromStationCode: query.fromStationCode.toUpperCase(),
      toStationCode: query.toStationCode.toUpperCase(),
      distanceKm: 0,
      baseFare: 0,
      reservationCharge: 0,
      superfastCharge: 0,
      gst: 0,
      cateringCharge: 0,
      dynamicSurcharge: 0,
      totalFare: Math.round(total),
      currency: 'INR',
    };
  }

  // ------------------------------------------------------------------- PNR

  async getPnrStatus(pnr: string): Promise<PnrStatus> {
    const clean = pnr.replace(/\D/g, '');
    if (clean.length !== 10) {
      throw new RailDataError('INVALID_PNR', 'A PNR must be exactly 10 digits.');
    }

    const html = await this.http.getText(`${WEB_HOST}/pnr-status/${clean}`, {
      cacheTtlMs: 60_000,
      label: 'ConfirmTkt PNR',
    });

    // The page embeds its state as `data = {...};` in an inline script.
    const match = html.match(/\bdata\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!match?.[1]) {
      throw new RailDataError(
        'PNR_PARSE_FAILED',
        `Could not read a PNR result for ${clean}.`,
        'The upstream page layout may have changed, or the PNR may not exist. PNRs are purged a few days after travel.',
      );
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
      throw new RailDataError('PNR_PARSE_FAILED', `Malformed PNR payload for ${clean}.`);
    }

    return normalisePnrPayload(clean, data);
  }

  /** Not offered by this provider; the chain falls through to a keyed one. */
  async getLiveTrainStatus(trainNumber: string): Promise<LiveTrainStatus> {
    throw new RailDataError(
      'NOT_SUPPORTED',
      `ConfirmTkt does not expose a machine-readable running status for train ${trainNumber}.`,
    );
  }
}

// ------------------------------------------------------------- helpers

function normaliseClock(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = String(raw).trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!match) return null;
  return `${match[1]!.padStart(2, '0')}:${match[2]}`;
}

/**
 * ConfirmTkt returns a 7 character run mask. It is Monday-first, matching
 * `Train.runsOn`, so it maps across directly.
 */
function parseRunningDays(mask: string | undefined): boolean[] {
  if (!mask || mask.length < 7) return [true, true, true, true, true, true, true];
  return Array.from({ length: 7 }, (_, i) => mask[i] === '1' || mask[i] === 'Y');
}

export function classifyAvailability(text: string): {
  status: AvailabilityStatus;
  count?: number;
} {
  const upper = text.toUpperCase();

  if (upper.includes('AVAILABLE') || /\bAVL\b/.test(upper)) {
    const m = upper.match(/AVAILABLE[-\s]*(\d+)/);
    return m?.[1] ? { status: 'AVAILABLE', count: Number(m[1]) } : { status: 'AVAILABLE' };
  }
  if (upper.includes('REGRET') || upper.includes('NOT AVAILABLE')) {
    return { status: 'REGRET' };
  }
  if (upper.includes('RAC')) {
    const m = upper.match(/RAC[\s/]*(\d+)/);
    return m?.[1] ? { status: 'RAC', count: Number(m[1]) } : { status: 'RAC' };
  }
  if (upper.includes('WL')) {
    // "RLWL5/WL3" — the figure after the final WL is the live position.
    const m = upper.match(/WL[\s/]*(\d+)(?!.*WL)/);
    return m?.[1] ? { status: 'WAITLIST', count: Number(m[1]) } : { status: 'WAITLIST' };
  }
  if (upper.includes('CHART')) return { status: 'CHART_PREPARED' };
  if (upper.includes('DEPARTED') || upper.includes('TRAIN DEPARTED')) {
    return { status: 'CHART_PREPARED' };
  }
  return { status: 'NOT_APPLICABLE' };
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

function normalisePnrPayload(pnr: string, data: Record<string, unknown>): PnrStatus {
  const rawList =
    (data['passengerList'] as unknown) ??
    (data['passengers'] as unknown) ??
    (data['PassengerStatus'] as unknown) ??
    [];

  const rows = Array.isArray(rawList) ? (rawList as Record<string, unknown>[]) : [];

  const passengers: PnrPassenger[] = rows.map((row, i) => {
    const current =
      str(row, 'currentStatus', 'CurrentStatus', 'current_status') || 'UNKNOWN';
    const entry: PnrPassenger = {
      serial: Number(str(row, 'passengerSerialNumber', 'Number')) || i + 1,
      bookingStatus: str(row, 'bookingStatus', 'BookingStatus', 'booking_status') || current,
      currentStatus: current,
    };
    const coach = str(row, 'currentCoachId', 'Coach', 'coach');
    const berth = str(row, 'currentBerthNo', 'Berth', 'berth');
    if (coach) entry.coach = coach;
    if (berth) entry.berth = berth;
    return entry;
  });

  if (passengers.length === 0) {
    throw new RailDataError(
      'PNR_NOT_FOUND',
      `No booking found for PNR ${pnr}.`,
      'Check the number. PNRs are purged a few days after the journey date.',
    );
  }

  const rawDate = str(data, 'dateOfJourney', 'DateOfJourney', 'doj', 'journeyDate');
  const journeyDate = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : rawDate;

  const chartRaw = data['chartPrepared'] ?? data['ChartPrepared'] ?? data['chartStatus'];

  return {
    pnr,
    trainNumber: str(data, 'trainNumber', 'TrainNo', 'trainNo'),
    trainName: str(data, 'trainName', 'TrainName'),
    journeyDate,
    fromStationCode: str(data, 'boardingPoint', 'from', 'sourceStation', 'From').toUpperCase(),
    fromStationName: str(data, 'boardingPointName', 'fromName'),
    toStationCode: str(data, 'reservationUpto', 'to', 'destinationStation', 'To').toUpperCase(),
    toStationName: str(data, 'reservationUptoName', 'toName'),
    boardingStationCode: str(data, 'boardingPoint', 'From').toUpperCase(),
    reservedUpto: str(data, 'reservationUpto', 'To').toUpperCase(),
    travelClass: (str(data, 'journeyClass', 'Class', 'className') || 'SL').toUpperCase() as TravelClass,
    quota: (str(data, 'quota', 'Quota') || 'GN').toUpperCase() as Quota,
    chartPrepared:
      chartRaw === true ||
      String(chartRaw).toUpperCase().includes('PREPARED') ||
      String(chartRaw).toUpperCase() === 'TRUE',
    passengers,
  };
}
