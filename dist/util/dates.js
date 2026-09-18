import { RailDataError } from '../types.js';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Indian Standard Time offset in minutes (UTC+05:30). No DST. */
export const IST_OFFSET_MINUTES = 330;
/** Current date/time expressed in IST. */
export function nowInIst() {
    const now = new Date();
    return new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
}
/** Today's date in IST as "YYYY-MM-DD". */
export function todayIst() {
    return nowInIst().toISOString().slice(0, 10);
}
/** Validate and normalise an ISO date, defaulting to today (IST). */
export function parseDate(input) {
    if (!input || input.trim() === '' || input.toLowerCase() === 'today') {
        return todayIst();
    }
    const value = input.trim();
    if (value.toLowerCase() === 'tomorrow') {
        return addDays(todayIst(), 1);
    }
    if (!ISO_DATE.test(value)) {
        throw new RailDataError('INVALID_DATE', `"${input}" is not a valid date.`, 'Use the ISO format YYYY-MM-DD, or "today" / "tomorrow".');
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new RailDataError('INVALID_DATE', `"${input}" is not a real calendar date.`);
    }
    return value;
}
export function addDays(isoDate, days) {
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
/** Day of week with Monday = 0, matching `Train.runsOn`. */
export function weekdayIndex(isoDate) {
    const jsDay = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    return (jsDay + 6) % 7;
}
export const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Minutes since midnight for a "HH:mm" string. */
export function toMinutes(hhmm) {
    const [h = 0, m = 0] = hhmm.split(':').map(Number);
    return h * 60 + m;
}
/** Format a minute count as "Xh Ym". */
export function formatDuration(minutes) {
    const sign = minutes < 0 ? '-' : '';
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    if (h === 0)
        return `${sign}${m}m`;
    return `${sign}${h}h ${m.toString().padStart(2, '0')}m`;
}
/** Number of days between two ISO dates (b - a). */
export function daysBetween(a, b) {
    const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
    return Math.round(ms / 86_400_000);
}
//# sourceMappingURL=dates.js.map