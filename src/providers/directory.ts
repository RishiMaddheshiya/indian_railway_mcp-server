import { STATIONS, STATION_BY_CODE } from '../data/stations.js';
import {
  RailDataError,
  type Availability,
  type FareBreakdown,
  type LiveTrainStatus,
  type PnrStatus,
  type ScheduleStop,
  type Station,
  type Train,
  type TrainBetweenStations,
} from '../types.js';
import type { RailProvider } from './provider.js';

const unsupported = (what: string): never => {
  throw new RailDataError(
    'NOT_SUPPORTED',
    `The bundled station directory does not provide ${what}.`,
  );
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
export class StationDirectoryProvider implements RailProvider {
  readonly name = 'station-directory';
  readonly isLive = false;

  async searchStations(query: string, limit: number): Promise<Station[]> {
    const q = query.trim().toLowerCase();
    if (!q) return STATIONS.slice(0, limit);

    const scored = STATIONS.map((station) => {
      const code = station.code.toLowerCase();
      const name = station.name.toLowerCase();
      let score = -1;
      if (code === q) score = 100;
      else if (name === q) score = 95;
      else if (name.startsWith(q)) score = 80;
      else if (code.startsWith(q)) score = 70;
      else if (name.includes(q)) score = 50;
      else if (station.state?.toLowerCase().includes(q)) score = 20;
      return { station, score };
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.station.name.localeCompare(b.station.name));

    if (scored.length === 0) {
      throw new RailDataError(
        'NO_STATIONS',
        `No station in the bundled directory matches "${query}".`,
      );
    }

    return scored.slice(0, limit).map((s) => s.station);
  }

  async getStation(code: string): Promise<Station | null> {
    return STATION_BY_CODE.get(code.trim().toUpperCase()) ?? null;
  }

  async findTrainsBetweenStations(): Promise<TrainBetweenStations[]> {
    return unsupported('train searches');
  }

  async getTrainSchedule(): Promise<{ train: Train; stops: ScheduleStop[] }> {
    return unsupported('train schedules');
  }

  async getAvailability(): Promise<Availability> {
    return unsupported('seat availability');
  }

  async getFare(): Promise<FareBreakdown> {
    return unsupported('fares');
  }

  async getPnrStatus(): Promise<PnrStatus> {
    return unsupported('PNR status');
  }

  async getLiveTrainStatus(): Promise<LiveTrainStatus> {
    return unsupported('running status');
  }
}
