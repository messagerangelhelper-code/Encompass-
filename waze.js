// Waze Deep Link — opens Waze (app on mobile, web map on desktop) with a destination
// pre-loaded and turn-by-turn navigation started. No partner approval needed for this;
// it's a one-way handoff (no ETA/route data comes back into this app). Applying for the
// Waze Transport SDK is the fuller integration to pursue later.
export function wazeNavigateUrl(addressQuery) {
  const q = encodeURIComponent(addressQuery);
  return `https://waze.com/ul?q=${q}&navigate=yes`;
}
