import { STATIONS, STATION_BY_CODE } from '../data/stations.js';
import { RailDataError, } from '../types.js';
const unsupported = (what) => {
    throw new RailDataError('NOT_SUPPORTED', `The bundled station directory does not provide ${what}.`);
};
/**
 * Station lookup only, from the bundled directory.
 *
 * This sits at the end of the live chain on purpose. Station codes and names
 * are static reference data — NDLS is New Delhi whether or not the network is
 * up — so answering them offline is accurate rather than misleading. It
 * deliberately refuses everything volatile (availability, fares, PNR, running
 * status), which must never be served from stale local data.
 */
export class StationDirectoryProvider {
    name = 'station-directory';
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
        if (scored.length === 0) {
            throw new RailDataError('NO_STATIONS', `No station in the bundled directory matches "${query}".`);
        }
        return scored.slice(0, limit).map((s) => s.station);
    }
    async getStation(code) {
        return STATION_BY_CODE.get(code.trim().toUpperCase()) ?? null;
    }
    async findTrainsBetweenStations() {
        return unsupported('train searches');
    }
    async getTrainSchedule() {
        return unsupported('train schedules');
    }
    async getAvailability() {
        return unsupported('seat availability');
    }
    async getFare() {
        return unsupported('fares');
    }
    async getPnrStatus() {
        return unsupported('PNR status');
    }
    async getLiveTrainStatus() {
        return unsupported('running status');
    }
}
//# sourceMappingURL=directory.js.map