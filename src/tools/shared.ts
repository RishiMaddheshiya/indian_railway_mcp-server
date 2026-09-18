import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { STATION_BY_CODE } from '../data/stations.js';
import { RailDataError, type Station } from '../types.js';
import type { RailProvider } from '../providers/provider.js';

/** A tool result carrying both prose for the model and structured data. */
export function ok(text: string, structured?: Record<string, unknown>): CallToolResult {
  const result: CallToolResult = {
    content: [{ type: 'text', text }],
  };
  if (structured) result.structuredContent = structured;
  return result;
}

export function failure(text: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text }],
  };
}

/**
 * Wrap a handler so provider failures come back as readable tool errors
 * instead of transport-level exceptions the model cannot act on.
 */
export async function guard(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof RailDataError) {
      const hint = error.hint ? `\n\nHint: ${error.hint}` : '';
      return failure(`${error.message}${hint}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    return failure(`Unexpected error: ${message}`);
  }
}

const CODE_PATTERN = /^[A-Z]{2,8}$/;

/**
 * Accept either a station code ("NDLS") or a name ("New Delhi") and resolve it
 * to a single station, so callers do not have to run a lookup first.
 */
export async function resolveStation(
  provider: RailProvider,
  input: string,
  label: string,
): Promise<Station> {
  const value = input.trim();
  if (!value) {
    throw new RailDataError('MISSING_STATION', `No ${label} station given.`);
  }

  const upper = value.toUpperCase();

  // A code in the bundled directory needs no lookup at all, so code-based
  // queries keep working even when upstream station search is unreachable.
  // Only an exact directory hit short-circuits: plenty of station NAMES are
  // also code-shaped once upper-cased ("Howrah", "Pune"), so a code-like
  // string is not on its own enough to skip the search.
  const known = STATION_BY_CODE.get(upper);
  if (known) return known;

  let matches: Station[] = [];
  let lookupError: unknown = null;
  try {
    matches = await provider.searchStations(value, 5);
  } catch (error) {
    lookupError = error;
  }

  if (matches.length === 0) {
    // Search is unavailable or found nothing. A well-formed code is still
    // usable: pass it through and let the downstream call report precisely.
    if (CODE_PATTERN.test(upper)) return { code: upper, name: upper };

    if (lookupError instanceof RailDataError) throw lookupError;
    throw new RailDataError(
      'STATION_NOT_FOUND',
      `Could not resolve ${label} station "${input}".`,
      'Use search_stations to find the right code.',
    );
  }

  const first = matches[0];
  if (!first) {
    throw new RailDataError('STATION_NOT_FOUND', `Could not resolve ${label} station "${input}".`);
  }

  // An exact code or name match wins outright; otherwise ambiguity is a real
  // risk (several "Delhi" stations), so surface the options rather than guess.
  const exactish = matches.find(
    (m) => m.code === upper || m.name.toLowerCase() === value.toLowerCase(),
  );
  if (exactish) return exactish;

  if (matches.length > 1) {
    const second = matches[1];
    if (second && second.name.toLowerCase().startsWith(value.toLowerCase())) {
      throw new RailDataError(
        'AMBIGUOUS_STATION',
        `"${input}" matches more than one station.`,
        matches.map((m) => `${m.code} = ${m.name}`).join('; '),
      );
    }
  }

  return first;
}
