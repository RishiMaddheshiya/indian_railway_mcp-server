/**
 * Deterministic pseudo-randomness.
 *
 * The mock provider must give the same answer for the same question every
 * time — otherwise availability would flicker between calls within a single
 * conversation and the model would contradict itself. Seeding on the query
 * string gives stable, plausible-looking variation.
 */
/** FNV-1a 32-bit hash. */
export function hashString(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}
/** Mulberry32 PRNG seeded from a string. Returns a function yielding [0, 1). */
export function seededRandom(seed) {
    let a = hashString(seed);
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** Integer in [min, max] inclusive. */
export function randomInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
}
//# sourceMappingURL=random.js.map