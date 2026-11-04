// Hauling rules for trucks and vans (pickup, cargo van, box truck).
// From a 2026 state-by-state guide to when an in-state, paid hauling truck needs a USDOT number.
// Not legal advice: check each state's DOT before launching there, and update this list when rules change.

export const HAUL_TYPES = ["truck", "cargo", "boxtruck"];

// Weight rating (GVWR, lbs) at which an in-state paid hauling truck needs a USDOT number.
export const STATE_DOT_LIMIT = {
  AL: 26001, AK: 14001, AZ: 26001, AR: 26001, CA: 1, CO: 16001, CT: 18001, DE: 26001, FL: 26001, GA: 10001,
  HI: 10001, ID: 26001, IL: 10001, IN: 10001, IA: 26001, KS: 10001, KY: 10001, LA: 26001, ME: 26001, MD: 10001,
  MA: 10001, MI: 26001, MN: 10001, MS: 26001, MO: 26001, MT: 26001, NE: 10001, NV: 26001, NH: 10001, NJ: 10001,
  NM: 26001, NY: 10001, NC: 26001, ND: 26001, OH: 10001, OK: 26001, OR: 10001, PA: 17001, RI: 10001, SC: 26001,
  SD: 26001, TN: 26001, TX: 26001, UT: 16001, VT: 26001, VA: 26001, WA: 16001, WV: 10001, WI: 26001, WY: 26001,
  DC: 10001,
};
// California needs a state motor carrier permit for any paid hauling, pickups included, hence 1.

export const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "Washington, DC",
};

export const FEDERAL_LIMIT = 10001;   // crossing a state line for pay needs a USDOT number from here
export const CDL_LIMIT = 26001;       // every state needs a CDL from here

// Used until the driver enters the weight from the sticker inside the driver's door.
export const DEFAULT_GVWR = { truck: 7000, cargo: 9500, boxtruck: 26000 };

export function isHauler(vehicleType) {
  return HAUL_TYPES.includes(vehicleType);
}

export function driverGvwr(driver) {
  const n = Number(driver?.gvwr);
  return n > 0 ? n : DEFAULT_GVWR[driver?.vehicleType] || 0;
}

export function hasBadge(driver) {
  return driver?.haulBadgeStatus === "approved";
}

// Why a driver without the badge can't take this job, or "" when they can.
export function haulBlockReason({ vehicleType, gvwr, pickupState, dropoffState }) {
  if (!isHauler(vehicleType)) return "";
  if (gvwr >= CDL_LIMIT) return "Trucks rated 26,001 lbs or more need a CDL and the Certified Hauler badge.";
  if (pickupState && dropoffState && pickupState !== dropoffState && gvwr >= FEDERAL_LIMIT)
    return "Jobs that cross a state line need a USDOT number (Certified Hauler badge).";
  for (const st of [pickupState, dropoffState]) {
    if (st && STATE_DOT_LIMIT[st] && gvwr >= STATE_DOT_LIMIT[st])
      return `${STATE_NAMES[st] || st} needs a USDOT number for paid hauling in a truck this size (Certified Hauler badge).`;
  }
  return "";
}

// States a driver without the badge can't haul in, for a truck of this weight rating.
export function restrictedStates(gvwr) {
  return Object.keys(STATE_DOT_LIMIT).filter((s) => gvwr >= STATE_DOT_LIMIT[s]).sort();
}

// Two-letter state for a map point, e.g. "TX". Free lookup, no key; cached per rounded point.
const _stateCache = new Map();
export async function stateFromPoint(pos) {
  if (!pos || pos.lat == null || pos.lng == null) return "";
  const key = `${Number(pos.lat).toFixed(2)},${Number(pos.lng).toFixed(2)}`;
  if (_stateCache.has(key)) return _stateCache.get(key);
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.lat}&longitude=${pos.lng}&localityLanguage=en`);
    const d = await r.json();
    const code = String(d.principalSubdivisionCode || "");
    const st = d.countryCode === "US" && code.startsWith("US-") ? code.slice(3) : "";
    _stateCache.set(key, st);
    return st;
  } catch {
    return "";
  }
}

// Can this driver take this ride? Badge holders can take any job their truck fits.
export async function canTakeRide(driver, ride) {
  if (!isHauler(driver?.vehicleType) || hasBadge(driver)) return true;
  const gvwr = driverGvwr(driver);
  const [pickupState, dropoffState] = await Promise.all([stateFromPoint(ride.pickup_location), stateFromPoint(ride.dropoff_location)]);
  if (!pickupState && gvwr >= FEDERAL_LIMIT) return false;      // can't tell where it is: play it safe
  return !haulBlockReason({ vehicleType: driver.vehicleType, gvwr, pickupState, dropoffState });
}

// The badge ID shown on the driver's Certified Hauler card.
export function badgeId(driver) {
  return "ECH-" + String(driver?.uid || driver?.id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
}
