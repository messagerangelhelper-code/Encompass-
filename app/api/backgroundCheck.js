// Driver background check fee. Drivers pay it themselves, either up front
// (Stripe Checkout) or taken out of their ride payouts until it's paid off.
// Change this one number if Checkr's price changes. $79.49 = Essential
// $59.99 + state criminal search $10 + driving record $9.50.
export const BACKGROUND_CHECK_FEE_CENTS = 7949;

export const dollars = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
