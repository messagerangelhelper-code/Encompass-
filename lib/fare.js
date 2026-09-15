
// Real fare formula, matching how Uber/Lyft actually price a ride:
// base fare + (per-mile x distance) + (per-minute x time) + service fee, with a minimum floor.
// Per-mile rate set to match typical Texas rideshare market rates (2026).
export const FARE_RATES = {
  base: 1.75,
  perMile: 1.04,
  perMinute: 0.28,
  serviceFee: 2.75,
  minimumFare: 7.50,
};

// Takes REAL miles/minutes (from Mapbox's Directions API — see
// getDrivingRoute in app/rider/page.js) and returns the fare. No more fake
// seeded numbers — this is the actual real-distance pricing function.
export function fareForTrip(miles, minutes) {
  const raw =
    FARE_RATES.base + miles * FARE_RATES.perMile + minutes * FARE_RATES.perMinute + FARE_RATES.serviceFee;
  const fare = Math.max(raw, FARE_RATES.minimumFare);
  return Math.round(fare * 100) / 100;
}
