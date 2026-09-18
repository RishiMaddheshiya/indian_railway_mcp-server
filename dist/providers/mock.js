import { STATIONS, STATION_BY_CODE } from '../data/stations.js';
import { TRAINS, TRAIN_BY_NUMBER } from '../data/trains.js';
import { RailDataError, } from '../types.js';
import { addDays, daysBetween, nowInIst, todayIst, toMinutes, weekdayIndex } from '../util/dates.js';
import { computeFare } from '../util/fares.js';
import { randomInt, seededRandom } from '../util/random.js';
/**
 * Offline provider backed by the bundled sample timetable.
 *
 * Every answer is deterministic for a given query, so repeated calls inside
 * one conversation stay consistent. Live-only facts (availability, PNR,
 * running status) are synthesised and clearly labelled as such by the tool
 * layer.
 */
export class MockProvider {
    name = 'mock';
    isLive = false;
    async searchStations(query, limit) {
        const q = query.trim().toLowerCase();
        if (!q)
            return STATIONS.slice(0, limit);
        const scored = STATIONS.map((station) => {
            const code = station.code.toLowerCase();
            const name = station.name.toLowerCase();
            let score = -1;
            if (code === q)
                score = 100;
            else if (name === q)
                score = 95;
            else if (name.startsWith(q))
                score = 80;
            else if (code.startsWith(q))
                score = 70;
            else if (name.includes(q))
                score = 50;
            else if (station.state?.toLowerCase().includes(q))
                score = 20;
            return { station, score };
        })
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score || a.station.name.localeCompare(b.station.name));
        return scored.slice(0, limit).map((s) => s.station);
    }
    async getStation(code) {
        return STATION_BY_CODE.get(code.trim().toUpperCase()) ?? null;
    }
    async findTrainsBetweenStations(query) {
        const from = query.fromStationCode.toUpperCase();
        const to = query.toStationCode.toUpperCase();
        if (from === to) {
            throw new RailDataError('SAME_STATION', 'Origin and destination are the same station.');
        }
        const results = [];
        for (const record of TRAINS) {
            const fromIdx = record.stops.findIndex((s) => s.stationCode === from);
            const toIdx = record.stops.findIndex((s) => s.stationCode === to);
            if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx)
                continue;
            const origin = record.stops[fromIdx];
            const dest = record.stops[toIdx];
            if (!origin?.departure || !dest?.arrival)
                continue;
            if (query.travelClass && !record.train.classes.includes(query.travelClass))
                continue;
            const dayOffset = dest.day - origin.day;
            const durationMinutes = toMinutes(dest.arrival) - toMinutes(origin.departure) + dayOffset * 1440;
            results.push({
                train: record.train,
                fromStationCode: origin.stationCode,
                fromStationName: origin.stationName,
                toStationCode: dest.stationCode,
                toStationName: dest.stationName,
                departure: origin.departure,
                arrival: dest.arrival,
                durationMinutes,
                distanceKm: dest.distanceKm - origin.distanceKm,
                runsOnDate: record.train.runsOn[weekdayIndex(query.date)] ?? false,
                arrivalDayOffset: dayOffset,
            });
        }
        return results.sort((a, b) => toMinutes(a.departure) - toMinutes(b.departure));
    }
    async getTrainSchedule(trainNumber) {
        const record = TRAIN_BY_NUMBER.get(trainNumber.trim());
        if (!record) {
            throw new RailDataError('TRAIN_NOT_FOUND', `Train ${trainNumber} is not in the bundled sample timetable.`, 'The offline dataset covers a sample of popular trains. Configure a live provider (IRCTC_PROVIDER=rapidapi) for full coverage.');
        }
        return { train: record.train, stops: record.stops };
    }
    async getAvailability(query) {
        const record = TRAIN_BY_NUMBER.get(query.trainNumber.trim());
        if (!record) {
            throw new RailDataError('TRAIN_NOT_FOUND', `Train ${query.trainNumber} is not in the bundled sample timetable.`);
        }
        if (!record.train.classes.includes(query.travelClass)) {
            throw new RailDataError('CLASS_NOT_AVAILABLE', `Train ${record.train.number} (${record.train.name}) does not have class ${query.travelClass}.`, `Available classes: ${record.train.classes.join(', ')}.`);
        }
        const seed = [
            query.trainNumber,
            query.fromStationCode,
            query.toStationCode,
            query.date,
            query.travelClass,
            query.quota,
        ].join('|');
        const rng = seededRandom(seed);
        const daysAhead = daysBetween(todayIst(), query.date);
        if (daysAhead < 0) {
            return {
                trainNumber: record.train.number,
                travelClass: query.travelClass,
                quota: query.quota,
                date: query.date,
                status: 'CHART_PREPARED',
                statusText: 'TRAIN DEPARTED',
                confirmationChance: 0,
            };
        }
        // Tatkal only opens one day before departure.
        if ((query.quota === 'TQ' || query.quota === 'PT') && daysAhead > 1) {
            return {
                trainNumber: record.train.number,
                travelClass: query.travelClass,
                quota: query.quota,
                date: query.date,
                status: 'NOT_APPLICABLE',
                statusText: 'TATKAL BOOKING NOT YET OPEN',
                confirmationChance: undefined,
            };
        }
        // Further out = better availability; premium classes are scarcer.
        const scarcity = query.travelClass === '1A' || query.travelClass === 'EC' ? 0.55 : 0.25;
        const pressure = Math.max(0, 1 - daysAhead / 45) + scarcity;
        const roll = rng() + pressure * 0.55;
        let status;
        let statusText;
        let count;
        let confirmationChance;
        if (roll < 0.75) {
            status = 'AVAILABLE';
            count = randomInt(rng, 1, query.travelClass === 'SL' ? 180 : 60);
            statusText = `AVAILABLE-${count.toString().padStart(4, '0')}`;
            confirmationChance = 1;
        }
        else if (roll < 0.95) {
            status = 'RAC';
            count = randomInt(rng, 1, 40);
            statusText = `RAC ${count}`;
            confirmationChance = 0.85;
        }
        else if (roll < 1.35) {
            status = 'WAITLIST';
            count = randomInt(rng, 1, 90);
            statusText = `WL ${count}`;
            confirmationChance = Math.max(0.05, Math.min(0.9, 1 - count / 100) * (daysAhead / 30 + 0.3));
        }
        else {
            status = 'REGRET';
            statusText = 'REGRET/WL CLOSED';
            confirmationChance = 0;
        }
        if (daysAhead === 0) {
            status = status === 'AVAILABLE' ? 'AVAILABLE' : 'CHART_PREPARED';
            if (status === 'CHART_PREPARED')
                statusText = `${statusText} (CHART PREPARED)`;
        }
        return {
            trainNumber: record.train.number,
            travelClass: query.travelClass,
            quota: query.quota,
            date: query.date,
            status,
            statusText,
            count,
            confirmationChance: Number(confirmationChance.toFixed(2)),
        };
    }
    async getFare(query) {
        const record = TRAIN_BY_NUMBER.get(query.trainNumber.trim());
        if (!record) {
            throw new RailDataError('TRAIN_NOT_FOUND', `Train ${query.trainNumber} is not in the bundled sample timetable.`);
        }
        const from = query.fromStationCode.toUpperCase();
        const to = query.toStationCode.toUpperCase();
        const fromStop = record.stops.find((s) => s.stationCode === from);
        const toStop = record.stops.find((s) => s.stationCode === to);
        if (!fromStop || !toStop) {
            throw new RailDataError('STATION_NOT_ON_ROUTE', `Train ${record.train.number} does not stop at ${!fromStop ? from : to}.`, `Route: ${record.stops.map((s) => s.stationCode).join(' -> ')}`);
        }
        if (fromStop.distanceKm >= toStop.distanceKm) {
            throw new RailDataError('WRONG_DIRECTION', `Train ${record.train.number} runs ${record.train.fromStationCode} -> ${record.train.toStationCode}; ${from} comes after ${to} on that route.`);
        }
        if (!record.train.classes.includes(query.travelClass)) {
            throw new RailDataError('CLASS_NOT_AVAILABLE', `Train ${record.train.number} does not have class ${query.travelClass}.`, `Available classes: ${record.train.classes.join(', ')}.`);
        }
        return computeFare({
            trainNumber: record.train.number,
            trainType: record.train.type,
            travelClass: query.travelClass,
            quota: query.quota,
            fromStationCode: from,
            toStationCode: to,
            distanceKm: toStop.distanceKm - fromStop.distanceKm,
            ageCategory: query.ageCategory,
        });
    }
    async getPnrStatus(pnr) {
        const clean = pnr.replace(/\D/g, '');
        if (clean.length !== 10) {
            throw new RailDataError('INVALID_PNR', 'A PNR must be exactly 10 digits.', `Received "${pnr}" (${clean.length} digits).`);
        }
        const rng = seededRandom(`pnr:${clean}`);
        const record = TRAINS[randomInt(rng, 0, TRAINS.length - 1)];
        if (!record)
            throw new RailDataError('NO_DATA', 'No sample trains available.');
        const originStop = record.stops[0];
        const destStop = record.stops[record.stops.length - 1];
        if (!originStop || !destStop) {
            throw new RailDataError('NO_DATA', 'Sample train has no stops.');
        }
        const journeyDate = addDays(todayIst(), randomInt(rng, 0, 20));
        const chartPrepared = daysBetween(todayIst(), journeyDate) <= 0;
        const travelClass = record.train.classes[randomInt(rng, 0, record.train.classes.length - 1)];
        const passengerCount = randomInt(rng, 1, 4);
        const passengers = [];
        const coachPrefix = travelClass === 'SL' ? 'S' : travelClass === '3A' ? 'B' : travelClass === '2A' ? 'A' : 'C';
        const berthTypes = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE LOWER', 'SIDE UPPER'];
        for (let i = 1; i <= passengerCount; i++) {
            const roll = rng();
            if (roll < 0.65) {
                const coach = `${coachPrefix}${randomInt(rng, 1, 6)}`;
                const berth = randomInt(rng, 1, 72);
                const berthType = berthTypes[randomInt(rng, 0, berthTypes.length - 1)] ?? 'LOWER';
                passengers.push({
                    serial: i,
                    bookingStatus: `CNF/${coach}/${berth}/${berthType}`,
                    currentStatus: `CNF/${coach}/${berth}/${berthType}`,
                    coach,
                    berth: String(berth),
                    berthType,
                });
            }
            else if (roll < 0.85) {
                const wl = randomInt(rng, 1, 30);
                const coach = `${coachPrefix}${randomInt(rng, 1, 6)}`;
                const berth = randomInt(rng, 1, 72);
                passengers.push({
                    serial: i,
                    bookingStatus: `WL/${wl + randomInt(rng, 5, 40)}`,
                    currentStatus: chartPrepared
                        ? `CNF/${coach}/${berth}/LOWER`
                        : `RAC ${randomInt(rng, 1, 25)}`,
                    coach: chartPrepared ? coach : null,
                    berth: chartPrepared ? String(berth) : null,
                    berthType: chartPrepared ? 'LOWER' : null,
                });
            }
            else {
                const wl = randomInt(rng, 1, 60);
                passengers.push({
                    serial: i,
                    bookingStatus: `WL/${wl + 20}`,
                    currentStatus: `WL/${wl}`,
                    coach: null,
                    berth: null,
                    berthType: null,
                });
            }
        }
        const fare = computeFare({
            trainNumber: record.train.number,
            trainType: record.train.type,
            travelClass,
            quota: 'GN',
            fromStationCode: originStop.stationCode,
            toStationCode: destStop.stationCode,
            distanceKm: destStop.distanceKm,
        });
        return {
            pnr: clean,
            trainNumber: record.train.number,
            trainName: record.train.name,
            journeyDate,
            fromStationCode: originStop.stationCode,
            fromStationName: originStop.stationName,
            toStationCode: destStop.stationCode,
            toStationName: destStop.stationName,
            boardingStationCode: originStop.stationCode,
            reservedUpto: destStop.stationCode,
            travelClass,
            quota: 'GN',
            chartPrepared,
            passengers,
            bookingFare: fare.totalFare * passengerCount,
            ticketFare: fare.totalFare * passengerCount,
        };
    }
    async getLiveTrainStatus(trainNumber, startDate) {
        const record = TRAIN_BY_NUMBER.get(trainNumber.trim());
        if (!record) {
            throw new RailDataError('TRAIN_NOT_FOUND', `Train ${trainNumber} is not in the bundled sample timetable.`);
        }
        const rng = seededRandom(`live:${trainNumber}:${startDate}`);
        const baseDelay = randomInt(rng, -5, 95);
        const ist = nowInIst();
        const nowMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
        const dayOffset = daysBetween(startDate, todayIst());
        const elapsed = dayOffset * 1440 + nowMinutes;
        const originDeparture = record.stops[0]?.departure;
        // `elapsed` and every scheduled time below are measured in minutes from
        // midnight of the start date, so they can be compared directly.
        const passed = [];
        const upcoming = [];
        let currentStationCode = null;
        let currentStationName = null;
        let delayMinutes = baseDelay;
        record.stops.forEach((stop, index) => {
            // Delay accumulates slowly then partially recovers on long runs.
            const progress = index / Math.max(1, record.stops.length - 1);
            const stopDelay = Math.max(0, Math.round(baseDelay * (0.4 + progress * 0.9) + randomInt(rng, -6, 8)));
            const schedArrivalAbs = stop.arrival
                ? (stop.day - 1) * 1440 + toMinutes(stop.arrival)
                : null;
            const schedDepartureAbs = stop.departure
                ? (stop.day - 1) * 1440 + toMinutes(stop.departure)
                : null;
            const arrivedAt = schedArrivalAbs === null ? null : schedArrivalAbs + stopDelay;
            const departedAt = schedDepartureAbs === null ? null : schedDepartureAbs + stopDelay;
            const hasArrived = arrivedAt !== null && elapsed >= arrivedAt;
            const hasDeparted = departedAt !== null && elapsed >= departedAt;
            const update = {
                stationCode: stop.stationCode,
                stationName: stop.stationName,
                scheduledArrival: stop.arrival,
                actualArrival: stop.arrival ? shiftTime(stop.arrival, stopDelay) : null,
                scheduledDeparture: stop.departure,
                actualDeparture: stop.departure ? shiftTime(stop.departure, stopDelay) : null,
                delayMinutes: stopDelay,
                distanceKm: stop.distanceKm,
                day: stop.day,
                platform: stop.platform ?? null,
                hasDeparted,
                hasArrived,
            };
            if (hasDeparted || (hasArrived && index === record.stops.length - 1)) {
                passed.push(update);
                currentStationCode = stop.stationCode;
                currentStationName = stop.stationName;
                delayMinutes = stopDelay;
            }
            else {
                upcoming.push(update);
            }
        });
        const journeyCompleted = upcoming.length === 0 && passed.length > 0;
        let position;
        if (passed.length === 0) {
            // Nothing has happened yet, so there is no delay to report.
            delayMinutes = 0;
            position = `Yet to start from ${record.train.fromStationName}. Scheduled departure ${originDeparture ?? 'n/a'}.`;
        }
        else if (journeyCompleted) {
            position = `Run completed at ${record.train.toStationName}${delayMinutes > 0 ? `, ${delayMinutes} min late` : ' on time'}.`;
        }
        else {
            const next = upcoming[0];
            position = `Departed ${currentStationName}; next halt ${next?.stationName ?? 'destination'} at ${next?.actualArrival ?? 'n/a'}${delayMinutes > 0 ? ` (running ${delayMinutes} min late)` : ' (on time)'}.`;
        }
        return {
            trainNumber: record.train.number,
            trainName: record.train.name,
            startDate,
            position,
            currentStationCode,
            currentStationName,
            delayMinutes,
            updatedAt: new Date().toISOString(),
            upcomingStations: upcoming,
            passedStations: passed,
            journeyCompleted,
        };
    }
}
function shiftTime(hhmm, deltaMinutes) {
    const total = (toMinutes(hhmm) + deltaMinutes + 1440 * 2) % 1440;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
//# sourceMappingURL=mock.js.map