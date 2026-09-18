import { z } from 'zod';
import { QUOTAS, TRAVEL_CLASSES, } from '../types.js';
import { formatDuration, parseDate, todayIst } from '../util/dates.js';
import { className, formatAvailability, formatFare, formatPnr, formatSchedule, formatStations, formatTrainsBetween, quotaName, rupees, runDays, table, } from '../util/format.js';
import { guard, ok, resolveStation } from './shared.js';
const travelClassEnum = z.enum(Object.keys(TRAVEL_CLASSES));
const quotaEnum = z.enum(Object.keys(QUOTAS));
const stationField = (role) => z
    .string()
    .min(2)
    .describe(`${role} station: either the station code (e.g. "NDLS") or the name (e.g. "New Delhi").`);
const dateField = z
    .string()
    .optional()
    .describe('Journey date as YYYY-MM-DD, or "today" / "tomorrow". Defaults to today in IST.');
/**
 * Note appended to every tool result describing where the data came from.
 *
 * With live providers this is a short attribution. With the offline
 * estimator it is a warning, because simulated availability that reads as
 * real is the most dangerous output this server can produce.
 */
function provenance(provider, kind) {
    if (provider.isLive) {
        return '\n\n_Live data via unofficial public rail endpoints — best-effort, not an official IRCTC feed. Verify before booking._';
    }
    if (kind === 'live') {
        return '\n\n_OFFLINE MODE: these figures are SIMULATED, not real. Availability, PNR and running status here are fabricated sample data. Unset IRCTC_PROVIDER=mock for live data._';
    }
    return '\n\n_OFFLINE MODE: bundled sample timetable (approximate, limited coverage). Unset IRCTC_PROVIDER=mock for live data._';
}
export function registerTools(server, provider) {
    // ------------------------------------------------------------- stations
    server.registerTool('search_stations', {
        title: 'Search railway stations',
        description: 'Find Indian Railways stations by name or code. Use this first when the user names a city rather than a station code, since most other tools need codes.',
        inputSchema: {
            query: z.string().min(1).describe('Station name, partial name, or code.'),
            limit: z.number().int().min(1).max(25).optional().describe('Max results (default 8).'),
        },
    }, async ({ query, limit }) => guard(async () => {
        const stations = await provider.searchStations(query, limit ?? 8);
        return ok(`Stations matching "${query}":\n\n${formatStations(stations)}${provenance(provider, 'static')}`, { stations, count: stations.length });
    }));
    // -------------------------------------------------------------- trains
    server.registerTool('find_trains_between_stations', {
        title: 'Find trains between two stations',
        description: 'List direct trains connecting two stations on a given date, with departure, arrival, duration and available classes. Station names are accepted and resolved automatically.',
        inputSchema: {
            from: stationField('Origin'),
            to: stationField('Destination'),
            date: dateField,
            travelClass: travelClassEnum.optional().describe('Only trains offering this class.'),
            sortBy: z
                .enum(['departure', 'duration', 'arrival'])
                .optional()
                .describe('Sort order (default departure).'),
            onlyRunningOnDate: z
                .boolean()
                .optional()
                .describe('Drop trains that do not run on the given date (default true).'),
        },
    }, async ({ from, to, date, travelClass, sortBy, onlyRunningOnDate }) => guard(async () => {
        const journeyDate = parseDate(date);
        const origin = await resolveStation(provider, from, 'origin');
        const destination = await resolveStation(provider, to, 'destination');
        const query = {
            fromStationCode: origin.code,
            toStationCode: destination.code,
            date: journeyDate,
        };
        if (travelClass)
            query.travelClass = travelClass;
        let results = await provider.findTrainsBetweenStations(query);
        if (onlyRunningOnDate !== false) {
            const running = results.filter((r) => r.runsOnDate);
            // Keep the full list if nothing runs, so the model can explain why.
            if (running.length > 0)
                results = running;
        }
        if (sortBy === 'duration') {
            results.sort((a, b) => a.durationMinutes - b.durationMinutes);
        }
        else if (sortBy === 'arrival') {
            results.sort((a, b) => a.arrivalDayOffset * 1440 - b.arrivalDayOffset * 1440 ||
                a.arrival.localeCompare(b.arrival));
        }
        const heading = `Trains from ${origin.name} (${origin.code}) to ${destination.name} (${destination.code}) on ${journeyDate}:`;
        return ok(`${heading}\n\n${formatTrainsBetween(results, journeyDate)}${provenance(provider, 'static')}`, {
            date: journeyDate,
            from: origin,
            to: destination,
            count: results.length,
            trains: results,
        });
    }));
    server.registerTool('get_train_schedule', {
        title: 'Get a train timetable',
        description: 'Full stop-by-stop schedule for a train number: arrival, departure, halt, distance, day and platform, plus the days of the week it runs.',
        inputSchema: {
            trainNumber: z.string().min(4).max(6).describe('Five digit train number, e.g. "12951".'),
        },
    }, async ({ trainNumber }) => guard(async () => {
        const { train, stops } = await provider.getTrainSchedule(trainNumber);
        return ok(`${formatSchedule(train, stops)}${provenance(provider, 'static')}`, {
            train,
            stops,
            stopCount: stops.length,
        });
    }));
    // ------------------------------------------------------- fares & seats
    server.registerTool('check_seat_availability', {
        title: 'Check seat availability',
        description: 'Seat or berth availability for one train, class and quota on a date. Returns the railway status string (AVAILABLE / RAC / WL / REGRET) and, where known, a confirmation estimate.',
        inputSchema: {
            trainNumber: z.string().min(4).max(6).describe('Five digit train number.'),
            from: stationField('Boarding'),
            to: stationField('Alighting'),
            date: dateField,
            travelClass: travelClassEnum.describe('Class to check, e.g. "3A".'),
            quota: quotaEnum.optional().describe('Booking quota (default GN = General).'),
        },
    }, async ({ trainNumber, from, to, date, travelClass, quota }) => guard(async () => {
        const journeyDate = parseDate(date);
        const origin = await resolveStation(provider, from, 'boarding');
        const destination = await resolveStation(provider, to, 'alighting');
        const availability = await provider.getAvailability({
            trainNumber: trainNumber.trim(),
            fromStationCode: origin.code,
            toStationCode: destination.code,
            date: journeyDate,
            travelClass,
            quota: quota ?? 'GN',
        });
        return ok(`${formatAvailability(availability)}\n\nRoute: ${origin.name} (${origin.code}) -> ${destination.name} (${destination.code})${provenance(provider, 'live')}`, { availability, from: origin, to: destination });
    }));
    server.registerTool('get_fare', {
        title: 'Get ticket fare',
        description: 'Itemised fare for a train, class and quota between two stations: base fare, reservation and superfast charges, catering, dynamic surcharge and GST.',
        inputSchema: {
            trainNumber: z.string().min(4).max(6).describe('Five digit train number.'),
            from: stationField('Boarding'),
            to: stationField('Alighting'),
            date: dateField,
            travelClass: travelClassEnum.describe('Class to price, e.g. "SL".'),
            quota: quotaEnum.optional().describe('Booking quota (default GN = General).'),
            ageCategory: z
                .enum(['adult', 'child', 'senior'])
                .optional()
                .describe('Passenger category for concessions (default adult).'),
            passengers: z
                .number()
                .int()
                .min(1)
                .max(6)
                .optional()
                .describe('Number of passengers, for a total (default 1).'),
        },
    }, async ({ trainNumber, from, to, date, travelClass, quota, ageCategory, passengers }) => guard(async () => {
        const journeyDate = parseDate(date);
        const origin = await resolveStation(provider, from, 'boarding');
        const destination = await resolveStation(provider, to, 'alighting');
        const query = {
            trainNumber: trainNumber.trim(),
            fromStationCode: origin.code,
            toStationCode: destination.code,
            travelClass,
            quota: quota ?? 'GN',
            date: journeyDate,
        };
        if (ageCategory)
            query.ageCategory = ageCategory;
        const fare = await provider.getFare(query);
        const count = passengers ?? 1;
        const totalLine = count > 1
            ? `\n\nTotal for ${count} passengers: **${rupees(fare.totalFare * count)}**`
            : '';
        return ok(`${formatFare(fare)}${totalLine}${provenance(provider, 'static')}`, {
            fare,
            passengers: count,
            grandTotal: fare.totalFare * count,
        });
    }));
    // ------------------------------------------------------ status lookups
    server.registerTool('get_pnr_status', {
        title: 'Get PNR status',
        description: 'Current status of a 10 digit PNR: train, journey date, route, class and per-passenger booking and current status (CNF / RAC / WL) with coach and berth.',
        inputSchema: {
            pnr: z.string().min(10).max(13).describe('10 digit PNR number.'),
        },
    }, async ({ pnr }) => guard(async () => {
        const status = await provider.getPnrStatus(pnr);
        const confirmed = status.passengers.filter((p) => p.currentStatus.toUpperCase().startsWith('CNF')).length;
        const summary = `${confirmed} of ${status.passengers.length} passenger(s) confirmed.`;
        return ok(`${formatPnr(status)}\n\n${summary}${provenance(provider, 'live')}`, { pnr: status, confirmedCount: confirmed });
    }));
    // ------------------------------------------------------ journey planner
    server.registerTool('plan_journey', {
        title: 'Plan a rail journey',
        description: 'One-shot journey planner: finds trains between two stations on a date, then checks availability and fares for the preferred classes and ranks the options. Use this instead of chaining the individual tools when the user asks how to get from A to B.',
        inputSchema: {
            from: stationField('Origin'),
            to: stationField('Destination'),
            date: dateField,
            preferredClasses: z
                .array(travelClassEnum)
                .min(1)
                .max(4)
                .optional()
                .describe('Classes to price and check, best first (default ["3A","SL"]).'),
            quota: quotaEnum.optional().describe('Booking quota (default GN).'),
            passengers: z.number().int().min(1).max(6).optional().describe('Passenger count (default 1).'),
            maxOptions: z
                .number()
                .int()
                .min(1)
                .max(10)
                .optional()
                .describe('How many trains to evaluate (default 5).'),
            optimiseFor: z
                .enum(['balanced', 'fastest', 'cheapest', 'availability'])
                .optional()
                .describe('Ranking objective (default balanced).'),
        },
    }, async ({ from, to, date, preferredClasses, quota, passengers, maxOptions, optimiseFor }) => guard(async () => {
        const journeyDate = parseDate(date);
        const origin = await resolveStation(provider, from, 'origin');
        const destination = await resolveStation(provider, to, 'destination');
        const classes = preferredClasses ?? ['3A', 'SL'];
        const bookingQuota = quota ?? 'GN';
        const paxCount = passengers ?? 1;
        const limit = maxOptions ?? 5;
        const objective = optimiseFor ?? 'balanced';
        const trains = await provider.findTrainsBetweenStations({
            fromStationCode: origin.code,
            toStationCode: destination.code,
            date: journeyDate,
        });
        const running = trains.filter((t) => t.runsOnDate);
        const candidates = (running.length > 0 ? running : trains).slice(0, limit);
        if (candidates.length === 0) {
            return ok(`No direct trains found from ${origin.name} (${origin.code}) to ${destination.name} (${destination.code}) on ${journeyDate}. Consider a nearby junction or a connecting journey.${provenance(provider, 'static')}`, { date: journeyDate, from: origin, to: destination, options: [] });
        }
        const options = await Promise.all(candidates.map(async (candidate) => {
            const usable = classes.filter((c) => candidate.train.classes.includes(c));
            const perClass = await Promise.all(usable.map(async (travelClass) => {
                const [availability, fare] = await Promise.all([
                    provider
                        .getAvailability({
                        trainNumber: candidate.train.number,
                        fromStationCode: origin.code,
                        toStationCode: destination.code,
                        date: journeyDate,
                        travelClass,
                        quota: bookingQuota,
                    })
                        .catch(() => null),
                    provider
                        .getFare({
                        trainNumber: candidate.train.number,
                        fromStationCode: origin.code,
                        toStationCode: destination.code,
                        travelClass,
                        quota: bookingQuota,
                        date: journeyDate,
                    })
                        .catch(() => null),
                ]);
                return { travelClass, availability, fare };
            }));
            return { candidate, perClass };
        }));
        const score = (opt) => {
            const best = opt.perClass.find((p) => p.availability?.status === 'AVAILABLE')
                ?? opt.perClass[0];
            const availabilityScore = scoreAvailability(best?.availability ?? null);
            const durationHours = opt.candidate.durationMinutes / 60;
            const cost = best?.fare?.totalFare ?? 0;
            switch (objective) {
                case 'fastest':
                    return durationHours * 10 - availabilityScore;
                case 'cheapest':
                    return cost / 100 - availabilityScore;
                case 'availability':
                    return -availabilityScore * 10 + durationHours;
                default:
                    return durationHours * 2 + cost / 400 - availabilityScore * 3;
            }
        };
        options.sort((a, b) => score(a) - score(b));
        const rows = options.flatMap((opt) => opt.perClass.map((p) => [
            opt.candidate.train.number,
            opt.candidate.train.name,
            `${opt.candidate.departure} -> ${opt.candidate.arrival}${opt.candidate.arrivalDayOffset > 0 ? ` (+${opt.candidate.arrivalDayOffset}d)` : ''}`,
            formatDuration(opt.candidate.durationMinutes),
            p.travelClass,
            p.availability?.statusText ?? 'n/a',
            p.fare ? rupees(p.fare.totalFare * paxCount) : 'n/a',
        ]));
        const heading = [
            `**${origin.name} (${origin.code}) -> ${destination.name} (${destination.code})** on ${journeyDate}`,
            `${paxCount} passenger(s), ${quotaName(bookingQuota)} quota, ranked by ${objective}.`,
        ].join('\n');
        const body = rows.length > 0
            ? table(['Train', 'Name', 'Timing', 'Duration', 'Class', 'Availability', `Fare (${paxCount} pax)`], rows)
            : `None of these trains offer ${classes.join(' or ')}. Classes on offer: ${[
                ...new Set(candidates.flatMap((c) => c.train.classes)),
            ].join(', ')}.`;
        const top = options[0];
        const recommendation = top
            ? `\n\n**Best match:** ${top.candidate.train.number} ${top.candidate.train.name}, departing ${top.candidate.departure}, ${formatDuration(top.candidate.durationMinutes)} journey.`
            : '';
        return ok(`${heading}\n\n${body}${recommendation}${provenance(provider, 'live')}`, {
            date: journeyDate,
            from: origin,
            to: destination,
            quota: bookingQuota,
            passengers: paxCount,
            optimiseFor: objective,
            options: options.map((opt) => ({
                train: opt.candidate.train,
                departure: opt.candidate.departure,
                arrival: opt.candidate.arrival,
                durationMinutes: opt.candidate.durationMinutes,
                arrivalDayOffset: opt.candidate.arrivalDayOffset,
                classes: opt.perClass,
            })),
        });
    }));
    // --------------------------------------------------------- reference
    server.registerTool('list_reference_data', {
        title: 'List classes and quotas',
        description: 'Reference list of Indian Railways travel class codes and booking quota codes, for interpreting or constructing other tool calls.',
        inputSchema: {
            kind: z
                .enum(['classes', 'quotas', 'both'])
                .optional()
                .describe('Which reference list to return (default both).'),
        },
    }, async ({ kind }) => guard(async () => {
        const which = kind ?? 'both';
        const parts = [];
        if (which === 'classes' || which === 'both') {
            parts.push(`**Travel classes**\n\n${table(['Code', 'Meaning'], Object.entries(TRAVEL_CLASSES).map(([c, n]) => [c, n]))}`);
        }
        if (which === 'quotas' || which === 'both') {
            parts.push(`**Quotas**\n\n${table(['Code', 'Meaning'], Object.entries(QUOTAS).map(([c, n]) => [c, n]))}`);
        }
        return ok(parts.join('\n\n'), {
            classes: TRAVEL_CLASSES,
            quotas: QUOTAS,
            provider: provider.name,
            isLive: provider.isLive,
            today: todayIst(),
        });
    }));
}
function scoreAvailability(a) {
    if (!a)
        return 0;
    switch (a.status) {
        case 'AVAILABLE':
            return 3;
        case 'RAC':
            return 2;
        case 'WAITLIST':
            return (a.confirmationChance ?? 0.3) * 1.5;
        default:
            return 0;
    }
}
/** Re-exported so the resource layer can describe the same vocabulary. */
export { className, quotaName, runDays };
//# sourceMappingURL=register.js.map