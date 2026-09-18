/**
 * Deterministic pseudo-randomness.
 *
 * The mock provider must give the same answer for the same question every
 * time — otherwise availability would flicker between calls within a single
 * conversation and the model would contradict itself. Seeding on the query
 * string gives stable, plausible-looking variation.
 */
/** FNV-1a 32-bit hash. */
export declare function hashString(input: string): number;
/** Mulberry32 PRNG seeded from a string. Returns a function yielding [0, 1). */
export declare function seededRandom(seed: string): () => number;
/** Integer in [min, max] inclusive. */
export declare function randomInt(rng: () => number, min: number, max: number): number;
