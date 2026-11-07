// Encompass fare formula: base + (per mile x miles) + (per minute x minutes),
// times the vehicle multiplier, then Encompass's flat service fee on top,
// with a minimum fare.
// Rates follow typical Texas UberX / Lyft Standard rate cards (Houston, Dallas,
// Austin, San Antonio, Nov 2026): base ~$1.18-1.45, per mile ~$1.00-1.22,
// per minute ~$0.17-0.24, minimum ~$5.20-6.10.
// The service fee is what Encompass keeps; drivers are paid fare minus this
// fee (see lib/stripeServer.js driverPayoutCents).
export const FARE_RATES = {
  base: 1.25,
  perMile: 1.08,
  perMinute: 0.19,
  serviceFee: 2.75,
  minimumFare: 6.0,
};

// miles/minutes are the real driving route from Mapbox. The vehicle
// multiplier (XL, truck, etc.) applies to the ride part only, not the fee.
export function fareForTrip(miles, minutes, multiplier = 1) {
  const ride = FARE_RATES.base + miles * FARE_RATES.perMile + minutes * FARE_RATES.perMinute;
  const raw = ride * (Number(multiplier) || 1) + FARE_RATES.serviceFee;
  const fare = Math.max(raw, FARE_RATES.minimumFare);
  return Math.round(fare * 100) / 100;
}
