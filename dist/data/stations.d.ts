import type { Station } from '../types.js';
/**
 * A sample of major Indian Railways stations.
 *
 * This is bundled reference data for the offline `mock` provider and for
 * resolving station names to codes. It is a representative subset (not the
 * full ~7,000 station list) and coordinates are approximate.
 */
export declare const STATIONS: Station[];
/** Fast lookup by station code. */
export declare const STATION_BY_CODE: Map<string, Station>;
