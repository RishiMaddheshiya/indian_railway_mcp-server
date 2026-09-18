/** Indian Standard Time offset in minutes (UTC+05:30). No DST. */
export declare const IST_OFFSET_MINUTES = 330;
/** Current date/time expressed in IST. */
export declare function nowInIst(): Date;
/** Today's date in IST as "YYYY-MM-DD". */
export declare function todayIst(): string;
/** Validate and normalise an ISO date, defaulting to today (IST). */
export declare function parseDate(input: string | undefined): string;
export declare function addDays(isoDate: string, days: number): string;
/** Day of week with Monday = 0, matching `Train.runsOn`. */
export declare function weekdayIndex(isoDate: string): number;
export declare const WEEKDAY_NAMES: readonly ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Minutes since midnight for a "HH:mm" string. */
export declare function toMinutes(hhmm: string): number;
/** Format a minute count as "Xh Ym". */
export declare function formatDuration(minutes: number): string;
/** Number of days between two ISO dates (b - a). */
export declare function daysBetween(a: string, b: string): number;
