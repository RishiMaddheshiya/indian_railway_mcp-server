import type { FareBreakdown, Quota, TravelClass } from '../types.js';

/**
 * Approximate fare model for the offline provider.
 *
 * Indian Railways fares are set by a published per-kilometre slab table plus
 * a stack of fixed charges. This reproduces the *shape* of a real fare
 * (base + reservation + superfast + GST + catering + dynamic surcharge) with
 * plausible coefficients. It is an estimate, not a quotation.
 */

/** Rough paise-per-km rates by class, before rounding and surcharges. */
const RATE_PER_KM: Record<TravelClass, number> = {
  '1A': 4.25,
  EC: 3.0,
  '2A': 2.5,
  '3A': 1.75,
  '3E': 1.6,
  CC: 1.5,
  FC: 1.3,
  SL: 0.65,
  '2S': 0.35,
};

/** Fixed reservation charge in INR by class. */
const RESERVATION_CHARGE: Record<TravelClass, number> = {
  '1A': 60,
  EC: 60,
  '2A': 50,
  '3A': 40,
  '3E': 40,
  CC: 40,
  FC: 50,
  SL: 20,
  '2S': 15,
};

/** Superfast surcharge in INR by class. */
const SUPERFAST_CHARGE: Record<TravelClass, number> = {
  '1A': 75,
  EC: 75,
  '2A': 45,
  '3A': 45,
  '3E': 45,
  CC: 45,
  FC: 45,
  SL: 30,
  '2S': 15,
};

/** Classes that attract 5% GST (AC classes only). */
const GST_CLASSES = new Set<TravelClass>(['1A', '2A', '3A', '3E', 'EC', 'CC']);

/** Catering included on premium trains, in INR by class. */
const CATERING: Record<TravelClass, number> = {
  '1A': 425,
  EC: 375,
  '2A': 350,
  '3A': 320,
  '3E': 290,
  CC: 270,
  FC: 0,
  SL: 0,
  '2S': 0,
};

/** Quota multipliers applied to the base fare. */
const QUOTA_MULTIPLIER: Record<Quota, number> = {
  GN: 1.0,
  TQ: 1.3,
  PT: 1.5,
  LD: 1.0,
  SS: 1.0,
  HP: 0.75,
  DF: 1.0,
  FT: 1.0,
};

export interface FareInput {
  trainNumber: string;
  trainType: string;
  travelClass: TravelClass;
  quota: Quota;
  fromStationCode: string;
  toStationCode: string;
  distanceKm: number;
  ageCategory?: 'adult' | 'child' | 'senior';
}

const round5 = (n: number): number => Math.round(n / 5) * 5;

export function computeFare(input: FareInput): FareBreakdown {
  const {
    travelClass,
    quota,
    distanceKm,
    trainType,
    ageCategory = 'adult',
  } = input;

  const rate = RATE_PER_KM[travelClass] ?? 1;
  // Telescopic: the per-km rate tapers on longer runs.
  const taper = distanceKm > 1000 ? 0.88 : distanceKm > 500 ? 0.94 : 1;
  let baseFare = distanceKm * rate * taper;

  // Premium products carry a higher base.
  const premium = /rajdhani|shatabdi|vande bharat|duronto|tejas|gatimaan/i.test(trainType);
  if (premium) baseFare *= 1.35;

  baseFare *= QUOTA_MULTIPLIER[quota] ?? 1;

  if (ageCategory === 'child') baseFare *= 0.5;

  baseFare = round5(Math.max(baseFare, 30));

  const reservationCharge = RESERVATION_CHARGE[travelClass] ?? 20;
  const isSuperfast = premium || /superfast|express|mail/i.test(trainType);
  const superfastCharge = isSuperfast ? (SUPERFAST_CHARGE[travelClass] ?? 15) : 0;
  const cateringCharge = premium ? (CATERING[travelClass] ?? 0) : 0;

  // Dynamic (flexi) fare applies to Rajdhani/Shatabdi/Duronto in higher classes.
  const dynamicSurcharge =
    premium && quota !== 'HP' ? round5(baseFare * 0.1) : 0;

  const taxable =
    baseFare + reservationCharge + superfastCharge + cateringCharge + dynamicSurcharge;
  const gst = GST_CLASSES.has(travelClass) ? Math.round(taxable * 0.05) : 0;

  const totalFare = Math.round(taxable + gst);

  return {
    trainNumber: input.trainNumber,
    travelClass,
    quota,
    fromStationCode: input.fromStationCode,
    toStationCode: input.toStationCode,
    distanceKm,
    baseFare,
    reservationCharge,
    superfastCharge,
    gst,
    cateringCharge,
    dynamicSurcharge,
    totalFare,
    currency: 'INR',
  };
}
