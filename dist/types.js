/**
 * Domain types for Indian Railways / IRCTC data.
 *
 * These are provider-agnostic: every provider (mock, RapidAPI, a private
 * IRCTC partner API) normalises its own wire format into these shapes so the
 * MCP tools never have to care where the data came from.
 */
/** Reserved travel classes used by Indian Railways. */
export const TRAVEL_CLASSES = {
    '1A': 'AC First Class',
    '2A': 'AC 2 Tier',
    '3A': 'AC 3 Tier',
    '3E': 'AC 3 Tier (Economy)',
    EC: 'Executive Chair Car',
    CC: 'AC Chair Car',
    SL: 'Sleeper Class',
    '2S': 'Second Sitting',
    FC: 'First Class (non-AC)',
};
/** Booking quotas. GN (General) is the default for ordinary bookings. */
export const QUOTAS = {
    GN: 'General',
    TQ: 'Tatkal',
    PT: 'Premium Tatkal',
    LD: 'Ladies',
    SS: 'Senior Citizen / Lower berth',
    HP: 'Divyaangjan (handicapped)',
    DF: 'Defence',
    FT: 'Foreign Tourist',
};
/** Thrown by providers for user-actionable failures (bad code, no data, etc). */
export class RailDataError extends Error {
    code;
    hint;
    constructor(code, message, hint) {
        super(message);
        this.name = 'RailDataError';
        this.code = code;
        this.hint = hint;
    }
}
//# sourceMappingURL=types.js.map