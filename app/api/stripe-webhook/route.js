import { getStripe, userFromRequest, payDriverForRide } from "../../../lib/stripeServer";
import { rateLimit } from "../../../lib/rateLimit";

// Driver payout setup through Stripe Connect (Express accounts).
// POST with the driver signed in. Body: { checkOnly?: boolean }
// - Creates the driver's Stripe account the first time.
// - Returns { complete: true } once Stripe says payouts are ready (and pays
//   any finished rides that were waiting), otherwise { url } to Stripe's
//   onboarding page (unless checkOnly).

const RATE_LIMIT = { limit: 10, windowMs: 60_000, keyPrefix: "create-account-link" };

export async function POST(request) {
  try {
    const limited = rateLimit(request, RATE_LIMIT);
    if (limited) return limited;

    const stripe = getStripe();
    const { supabase, user } = await userFromRequest(request);
    if (!user) return Response.json({ error: "Sign in again." }, { status: 401 });
    const { data: driver, error: driverError } = await supabase
      .from("drivers").select("id, email, stripe_account_id, payout_setup_complete")
      .eq("id", user.id).single();
    if (driverError || !driver) return Response.json({ error: "Driver profile not found." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    let accountId = driver.stripe_account_id;
    if (!accountId) {
      if (body.checkOnly) return Response.json({ complete: false });
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: driver.email || user.email,
        business_type: "individual",
        capabilities: { transfers: { requested: true } },
        metadata: { driver_id: driver.id },
      });
      accountId = account.id;
      const { error: saveError } = await supabase
        .from("drivers").update({ stripe_account_id: accountId }).eq("id", driver.id);
      if (saveError) {
        console.error("Couldn't save Stripe account id:", saveError);
        return Response.json({ error: "Couldn't save payout account." }, { status: 500 });
      }
    }
    const account = await stripe.accounts.retrieve(accountId);
    const complete = !!(account.details_submitted && account.payouts_enabled);
    if (complete !== !!driver.payout_setup_complete) {
      await supabase.from("drivers").update({ payout_setup_complete: complete }).eq("id", driver.id);
    }
    if (complete) {
      // Pay any finished rides from before payouts were set up.
      const { data: unpaid } = await supabase.from("rides").select("*")
        .eq("driver_uid", driver.id).eq("status", "completed").eq("driver_paid", false).limit(50);
      const ready = { ...driver, stripe_account_id: accountId, payout_setup_complete: true };
      for (const ride of unpaid || []) {
        try { await payDriverForRide(stripe, supabase, ride, ready); }
        catch (e) { console.error("Back pay failed for ride", ride.id, e.message); }
      }
      return Response.json({ complete: true });
    }
    if (body.checkOnly) return Response.json({ complete: false });
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${site}/driver?payout=refresh`,
      return_url: `${site}/driver?payout=done`,
      type: "account_onboarding",
    });
    return Response.json({ url: link.url });
  } catch (err) {
    console.error("Payout setup error:", err);
    return Response.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
