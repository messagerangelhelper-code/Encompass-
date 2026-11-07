// Server-only helpers for Stripe money moves. Used by the API routes.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { FARE_RATES } from "./fare";
import { getSupabaseAdmin } from "./supabaseAdmin";

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Payments aren't set up yet.");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Supabase client that acts as the signed-in user (from the Authorization
// header), so the database's own access rules apply. Returns { supabase, user }.
export async function userFromRequest(request) {
  const auth = request.headers.get("authorization") || "";
  const accessToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!accessToken) return { supabase: null, user: null };
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
  const { data: { user } } = await supabase.auth.getUser(accessToken);
  return { supabase, user: user || null };
}

// What the driver gets for a ride: the fare minus Encompass's service fee.
// Change DRIVER_SHARE_PERCENT on Render (e.g. 80) to pay a percentage instead.
export function driverPayoutCents(fare) {
  const pct = Number(process.env.DRIVER_SHARE_PERCENT);
  const dollars = pct > 0 && pct <= 100
    ? Number(fare) * (pct / 100)
    : Number(fare) - FARE_RATES.serviceFee;
  return Math.max(0, Math.round(dollars * 100));
}

// How much of this ride's payout goes to the driver's unpaid background
// check fee. Worked out once per ride in the database, so a retry never
// takes it twice.
async function backgroundFeeForRide(supabase, ride, driver, payoutCents) {
  if (ride.bg_fee_deducted_cents != null) return ride.bg_fee_deducted_cents;
  const { data: row } = await supabase
    .from("drivers").select("bg_fee_owed_cents").eq("id", driver.id).single();
  if (!row || !(row.bg_fee_owed_cents > 0)) return 0;
  const { data, error } = await getSupabaseAdmin().rpc("take_background_fee", {
    p_ride_id: String(ride.id),
    p_payout_cents: payoutCents,
  });
  if (error) throw new Error("Couldn't take background check fee: " + error.message);
  return Number(data) || 0;
}

// Sends the driver's share of one completed ride to their Stripe account,
// minus any background check fee they still owe.
// Safe to call more than once: Stripe's idempotency key stops double pay.
export async function payDriverForRide(stripe, supabase, ride, driver) {
  if (!ride || ride.status !== "completed" || ride.driver_paid) return { skipped: true };
  if (!ride.stripe_payment_intent) return { skipped: true, reason: "no payment on ride" };
  if (!driver?.stripe_account_id || !driver.payout_setup_complete) {
    return { skipped: true, reason: "driver payouts not set up" };
  }
  const payout = driverPayoutCents(ride.fare);
  if (payout <= 0) return { skipped: true };

  const feeTaken = await backgroundFeeForRide(supabase, ride, driver, payout);
  const amount = payout - feeTaken;
  if (amount <= 0) {
    await supabase.from("rides").update({ driver_paid: true }).eq("id", ride.id);
    return { paid: true, amount: 0, feeTaken };
  }

  const pi = await stripe.paymentIntents.retrieve(ride.stripe_payment_intent);
  const transfer = await stripe.transfers.create({
    amount,
    currency: "usd",
    destination: driver.stripe_account_id,
    source_transaction: pi.latest_charge,
    transfer_group: `ride-${ride.id}`,
    metadata: { ride_id: ride.id, driver_id: driver.id, background_fee_cents: String(feeTaken) },
  }, { idempotencyKey: `ride-payout-${ride.id}` });

  await supabase.from("rides").update({ driver_paid: true, driver_transfer_id: transfer.id }).eq("id", ride.id);
  return { paid: true, amount, feeTaken };
}
