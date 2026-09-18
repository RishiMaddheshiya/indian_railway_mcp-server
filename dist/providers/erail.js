import { RailDataError, } from '../types.js';
import { toMinutes, weekdayIndex } from '../util/dates.js';
import { HttpClient, normaliseTime } from '../util/http.js';
const HOST = 'https://erail.in';
const VALID_CLASSES = new Set(['1A', '2A', '3A', '3E', 'EC', 'CC', 'SL', '2S', 'FC']);
/**
 * Live provider backed by eRail's public data endpoints. No API key needed.
 *
 * eRail answers with a tilde/caret delimited text format rather than JSON.
 * The layout below was read off live responses; the field positions are fixed,
 * so parsing uses absolute indices rather than filtering blanks (a blank field
 * is meaningful and dropping it would silently shift every later column).
 *
 * Unofficial and best-effort: this is the feed eRail's own site uses, not an
 * IRCTC partner API.
 */
export class ErailProvider {
    name = 'erail';
    isLive = true;
    http;
    constructor(timeoutMs = 15_000) {
        this.http = new HttpClient(timeoutMs);
    }
    async fetchTrains(params, label) {
        const url = `${HOST}/rail/getTrains.aspx?${params}&DataSource=0&Language=0&Cache=true`;
        const body = await this.http.getText(url, { cacheTtlMs: 10 * 60 * 1000, label });
        const head = body.slice(0, 200);
        if (/Please try again after some time/i.test(head)) {
            throw new RailDataError('UPSTREAM_BUSY', 'eRail asked us to retry later.');
        }
        if (/From station not found/i.test(head)) {
            throw new RailDataError('STATION_NOT_FOUND', 'eRail does not recognise the origin station code.');
        }
        if (/To station not found/i.test(head)) {
            throw new RailDataError('STATION_NOT_FOUND', 'eRail does not recognise the destination station code.');
        }
        if (/Train not found/i.test(head)) {
            throw new RailDataError('TRAIN_NOT_FOUND', 'eRail does not recognise that train number.');
        }
        if (/No direct trains found/i.test(head)) {
            return '';
        }
        return body;
    }
    /** eRail has no station search endpoint; the chain falls back for this. */
    async searchStations(query) {
        throw new RailDataError('NOT_SUPPORTED', `eRail has no station search endpoint (query "${query}").`);
    }
    async getStation() {
        return null;
    }
    async findTrainsBetweenStations(query) {
        const from = query.fromStationCode.toUpperCase();
        const to = query.toStationCode.toUpperCase();
        if (from === to) {
            throw new RailDataError('SAME_STATION', 'Origin and destination are the same station.');
        }
        const body = await this.fetchTrains(`Station_From=${encodeURIComponent(from)}&Station_To=${encodeURIComponent(to)}`, 'eRail trains-between');
        if (!body)
            return [];
        const results = [];
        // Each train record starts with "~^"; the header before the first one
        // carries the queried station names and is skipped.
        for (const chunk of body.split('~^').slice(1)) {
            const f = chunk.split('~');
            const number = (f[0] ?? '').trim();
            if (!/^\d{4,6}$/.test(number))
                continue;
            const departure = normaliseTime(f[10]) ?? '00:00';
            const arrival = normaliseTime(f[11]) ?? '00:00';
            let durationMinutes = hhDotMmToMinutes(f[12]);
            if (durationMinutes <= 0) {
                durationMinutes = toMinutes(arrival) - toMinutes(departure);
                if (durationMinutes < 0)
                    durationMinutes += 1440;
            }
            const runsOn = parseErailRunDays(f[13]);
            const classes = parseClassesFromAvailabilityBlock(chunk);
            const train = {
                number,
                name: (f[1] ?? number).trim(),
                type: (f[32] ?? '').trim() || 'Express',
                fromStationCode: (f[3] ?? from).trim().toUpperCase(),
                fromStationName: (f[2] ?? '').trim(),
                toStationCode: (f[5] ?? to).trim().toUpperCase(),
                toStationName: (f[4] ?? '').trim(),
                runsOn,
                classes,
            };
            results.push({
                train,
                fromStationCode: (f[7] ?? from).trim().toUpperCase(),
                fromStationName: (f[6] ?? '').trim(),
                toStationCode: (f[9] ?? to).trim().toUpperCase(),
                toStationName: (f[8] ?? '').trim(),
                departure,
                arrival,
                durationMinutes,
                distanceKm: 0,
                runsOnDate: runsOn[weekdayIndex(query.date)] ?? true,
                arrivalDayOffset: Math.floor((toMinutes(departure) + durationMinutes) / 1440),
            });
        }
        return results.sort((a, b) => toMinutes(a.departure) - toMinutes(b.departure));
    }
    async getTrainSchedule(trainNumber) {
        const number = trainNumber.trim();
        // Step 1: resolve the train to eRail's internal id. The route endpoint
        // keys on that id, not on the public train number.
        const info = await this.fetchTrains(`TrainNo=${encodeURIComponent(number)}`, 'eRail train lookup');
        // A TrainNo query returns the same "~^"-delimited record shape as a
        // trains-between query, so the field positions below match that parser.
        const record = info.split('~^')[1];
        if (!record) {
            throw new RailDataError('TRAIN_NOT_FOUND', `eRail returned no details for train ${number}.`);
        }
        const f = record.split('~');
        const trainId = (f[33] ?? '').trim();
        if (!trainId) {
            throw new RailDataError('NO_SCHEDULE', `Could not resolve an eRail route id for train ${number}.`);
        }
        // Step 2: fetch the route for that id.
        const routeBody = await this.http.getText(`${HOST}/data.aspx?Action=TRAINROUTE&Password=2012&Data1=${encodeURIComponent(trainId)}&Data2=0&Cache=true`, { cacheTtlMs: 24 * 60 * 60 * 1000, label: 'eRail route' });
        const stops = [];
        // The route payload opens with "^1~..." (no leading tilde), unlike the
        // trains-between payload, so the separator is matched with an optional one
        // and blank leading segments are dropped rather than a fixed first record.
        for (const chunk of routeBody.split(/~?\^/).filter((c) => c.trim() !== '')) {
            const f = chunk.split('~');
            const code = (f[1] ?? '').trim().toUpperCase();
            if (!code)
                continue;
            stops.push({
                stationCode: code,
                stationName: (f[2] ?? '').trim(),
                arrival: normaliseTime(f[3]),
                departure: normaliseTime(f[4]),
                haltMinutes: Number(f[5]) || 0,
                distanceKm: Number(f[6]) || 0,
                day: Number(f[7]) || 1,
                platform: null,
            });
        }
        if (stops.length === 0) {
            throw new RailDataError('NO_SCHEDULE', `eRail returned an empty route for train ${number}.`);
        }
        const first = stops[0];
        const last = stops[stops.length - 1];
        const train = {
            number: (f[0] ?? number).replace('^', '').trim(),
            name: (f[1] ?? number).trim(),
            type: (f[32] ?? '').trim() || 'Express',
            fromStationCode: first.stationCode,
            fromStationName: first.stationName,
            toStationCode: last.stationCode,
            toStationName: last.stationName,
            runsOn: parseErailRunDays(f[13]),
            classes: parseClassesFromAvailabilityBlock(record),
        };
        return { train, stops };
    }
    async getAvailability(query) {
        throw new RailDataError('NOT_SUPPORTED', `eRail does not expose live seat availability for train ${query.trainNumber}.`);
    }
    async getFare(query) {
        throw new RailDataError('NOT_SUPPORTED', `eRail does not expose a per-class fare lookup for train ${query.trainNumber}.`);
    }
    async getPnrStatus(pnr) {
        throw new RailDataError('NOT_SUPPORTED', `eRail does not expose PNR status (${pnr}).`);
    }
    async getLiveTrainStatus(trainNumber) {
        throw new RailDataError('NOT_SUPPORTED', `eRail does not expose running status for train ${trainNumber}.`);
    }
}
// ------------------------------------------------------------- helpers
/** eRail encodes durations as "HH.mm", e.g. "17.40" = 17h 40m. */
function hhDotMmToMinutes(raw) {
    if (!raw)
        return 0;
    const m = raw.trim().match(/^(\d{1,3})[.:](\d{2})$/);
    if (!m)
        return 0;
    return Number(m[1]) * 60 + Number(m[2]);
}
/**
 * eRail's 7 character run mask is NOT Monday-first. Its own site maps a
 * JavaScript day number d to mask index `d <= 2 ? d + 4 : d - 3`, which puts
 * the mask in Wed,Thu,Fri,Sat,Sun,Mon,Tue order. This converts it to the
 * Monday-first order `Train.runsOn` uses.
 */
function parseErailRunDays(mask) {
    const fallback = [true, true, true, true, true, true, true];
    if (!mask || mask.trim().length < 7)
        return fallback;
    const bits = mask.trim();
    // maskIndexForJsDay[jsDay] where jsDay 0 = Sunday.
    const maskIndexForJsDay = (jsDay) => (jsDay <= 2 ? jsDay + 4 : jsDay - 3);
    // runsOn is Monday-first: index 0 = Monday (jsDay 1) ... index 6 = Sunday (jsDay 0).
    return Array.from({ length: 7 }, (_, mondayFirst) => {
        const jsDay = (mondayFirst + 1) % 7;
        return bits[maskIndexForJsDay(jsDay)] === '1';
    });
}
/**
 * eRail appends a per-class block like "2A:39:28:...|3A:167:...|SL:118:...".
 * The class codes in it are the reliable signal for which classes a train has.
 */
function parseClassesFromAvailabilityBlock(chunk) {
    const out = [];
    for (const m of chunk.matchAll(/(^|[~|])([0-9A-Z]{2})\s*:/g)) {
        const code = (m[2] ?? '').toUpperCase();
        if (VALID_CLASSES.has(code) && !out.includes(code)) {
            out.push(code);
        }
    }
    const order = ['1A', '2A', '3A', '3E', 'EC', 'CC', 'SL', '2S', 'FC'];
    return out.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
//# sourceMappingURL=erail.js.map