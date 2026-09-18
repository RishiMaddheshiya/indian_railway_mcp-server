import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type Station } from '../types.js';
import type { RailProvider } from '../providers/provider.js';
/** A tool result carrying both prose for the model and structured data. */
export declare function ok(text: string, structured?: Record<string, unknown>): CallToolResult;
export declare function failure(text: string): CallToolResult;
/**
 * Wrap a handler so provider failures come back as readable tool errors
 * instead of transport-level exceptions the model cannot act on.
 */
export declare function guard(fn: () => Promise<CallToolResult>): Promise<CallToolResult>;
/**
 * Accept either a station code ("NDLS") or a name ("New Delhi") and resolve it
 * to a single station, so callers do not have to run a lookup first.
 */
export declare function resolveStation(provider: RailProvider, input: string, label: string): Promise<Station>;
