// Year-end reports for Admin: driver pay (for 1099s) and rider spending.
// These are Encompass's own app records. Stripe's records are the official ones.
import { supabase } from "./supabase";
import { FARE_RATES } from "./fare";

const cents = (n) => Math.round(Number(n || 0) * 100);
const dollars = (c) => (Number(c || 0) / 100).toFixed(2);

// Same split the payout code uses: fare minus Encompass's service fee.
export function driverShareCents(fare) {
  return Math.max(0, cents(fare) - cents(FARE_RATES.serviceFee));
}

// Every ride booked in a calendar year (Central time), loaded in pages.
export async function ridesForYear(year) {
  const start = new Date(`${year}-01-01T00:00:00-06:00`).toISOString();
  const end = new Date(`${Number(year) + 1}-01-01T00:00:00-06:00`).toISOString();
  const all = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase.from("rides")
      .select("id, created_at, status, fare, vehicle_type, rider_uid, rider_name, driver_uid, driver_name, driver_paid, refunded, bg_fee_deducted_cents")
      .gte("created_at", start).lt("created_at", end)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error("Couldn't load rides: " + error.message);
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

export function companyTotals(rides) {
  const done = rides.filter((r) => r.status === "completed");
  const gross = done.reduce((s, r) => s + cents(r.fare), 0);
  const share = done.reduce((s, r) => s + driverShareCents(r.fare), 0);
  const refunds = rides.filter((r) => r.refunded).reduce((s, r) => s + cents(r.fare), 0);
  const checkFees = done.reduce((s, r) => s + Number(r.bg_fee_deducted_cents || 0), 0);
  return {
    trips: done.length,
    gross: dollars(gross),
    fees: dollars(gross - share),
    driverShare: dollars(share),
    checkFees: dollars(checkFees),
    refunds: dollars(refunds),
  };
}

export function driverYearRows(rides, drivers) {
  const byId = new Map();
  for (const d of drivers) {
    byId.set(d.uid, { name: d.name || "", email: d.email || "", trips: 0, packages: 0, gross: 0, fee: 0, share: 0, checkFee: 0, paid: 0, unpaid: 0 });
  }
  for (const r of rides) {
    if (r.status !== "completed" || !r.driver_uid) continue;
    if (!byId.has(r.driver_uid)) byId.set(r.driver_uid, { name: r.driver_name || "", email: "", trips: 0, packages: 0, gross: 0, fee: 0, share: 0, checkFee: 0, paid: 0, unpaid: 0 });
    const row = byId.get(r.driver_uid);
    const share = driverShareCents(r.fare);
    const bg = Number(r.bg_fee_deducted_cents || 0);
    row.trips += 1;
    if (r.vehicle_type === "package") row.packages += 1;
    row.gross += cents(r.fare);
    row.share += share;
    row.fee += cents(r.fare) - share;
    row.checkFee += bg;
    if (r.driver_paid) row.paid += Math.max(0, share - bg);
    else row.unpaid += share;
  }
  return [...byId.entries()]
    .map(([uid, v]) => ({ uid, ...v, over2000: v.share >= 200000 }))
    .sort((a, b) => b.share - a.share);
}

export function riderYearRows(rides, riders) {
  const byId = new Map();
  for (const u of riders) byId.set(u.uid, { name: u.name || "", email: u.email || "", booked: 0, completed: 0, packages: 0, spent: 0, refunded: 0, refunds: 0 });
  for (const r of rides) {
    if (!r.rider_uid) continue;
    if (!byId.has(r.rider_uid)) byId.set(r.rider_uid, { name: r.rider_name || "", email: "", booked: 0, completed: 0, packages: 0, spent: 0, refunded: 0, refunds: 0 });
    const row = byId.get(r.rider_uid);
    row.booked += 1;
    if (r.vehicle_type === "package") row.packages += 1;
    if (r.status === "completed") { row.completed += 1; row.spent += cents(r.fare); }
    if (r.refunded) { row.refunded += 1; row.refunds += cents(r.fare); }
  }
  return [...byId.entries()].map(([uid, v]) => ({ uid, ...v })).sort((a, b) => b.spent - a.spent);
}

export { dollars };

// Saves a CSV file on the admin's device.
export function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s;          // stop spreadsheet formulas
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
