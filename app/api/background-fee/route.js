import { getStripe, userFromRequest } from "../../../lib/stripeServer";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { BACKGROUND_CHECK_FEE_CENTS } from "../../../lib/backgroundCheck";
import { rateLimit } from "../../../lib/rateLimit";

// Driver background check fee. POST with the driver signed in.
// Body: { action: "status" | "pay_now" | "from_payouts" }
// - status: where the driver's check and fee stand.
// - pay_now: returns { url } to a Stripe Checkout page for the fee
//   (or what's left of it). /api/stripe-webhook marks it paid.
// - from_payouts: records the fee as owed; it comes out of ride payouts.
// Either way the driver is marked ready for a Checkr invite.

const RATE_LIMIT = { limit: 10, windowMs: 60_000, keyPrefix: "background-fee" };
const FIELDS = "id, email, background_check_status, bg_fee_choice, bg_fee_status, bg_fee_owed_cents, checkr_invite_ready";

function statusOf(d) {
  return {
    checkStatus: d.background_check_status || "pending",
    feeStatus: d.bg_fee_status || "unpaid",
    choice: d.bg_fee_choice || null,
    owedCents: d.bg_fee_owed_cents || 0,
    inviteReady: !!d.checkr_invite_ready,
    feeCents: BACKGROUND_CHECK_FEE_CENTS,
  };
}

export async function POST(request) {
  try {
    const limited = rateLimit(request, RATE_LIMIT);
    if (limited) return limited;

    const { user } = await userFromRequest(request);
    if (!user) return Response.json({ error: "Sign in again." }, { status: 401 });

    const db = getSupabaseAdmin();
    const { data: driver, error } = await db.from("drivers").select(FIELDS).eq("id", user.id).single();
    if (error || !driver) return Response.json({ error: "Driver profile not found." }, { status: 404 });

    const { action } = await request.json().catch(() => ({}));
    const feeStatus = driver.bg_fee_status || "unpaid";

    if (action === "from_payouts") {
      if (feeStatus !== "unpaid") return Response.json(statusOf(driver));
      const { data: updated, error: saveError } = await db.from("drivers").update({
        bg_fee_choice: "from_payouts",
        bg_fee_status: "owed",
        bg_fee_owed_cents: BACKGROUND_CHECK_FEE_CENTS,
        checkr_invite_ready: true,
      }).eq("id", driver.id).eq("bg_fee_status", "unpaid").select(FIELDS).maybeSingle();
      if (saveError) {
        console.error("Background fee save error:", saveError);
        return Response.json({ error: "Couldn't save your choice. Try again." }, { status: 500 });
      }
      return Response.json(statusOf(updated || driver));
    }

    if (action === "pay_now") {
      if (feeStatus === "paid") return Response.json(statusOf(driver));
      // Admin turned the whole app off: no payments.
      const { data: siteRow } = await db.from("site_settings").select("site_enabled").eq("id", 1).maybeSingle();
      if (siteRow && siteRow.site_enabled === false) {
        return Response.json({ error: "Encompass is temporarily unavailable. Check back soon." }, { status: 503 });
      }
      const amount = feeStatus === "owed" ? driver.bg_fee_owed_cents : BACKGROUND_CHECK_FEE_CENTS;
      if (!amount || amount <= 0) return Response.json(statusOf(driver));

      const site = process.env.NEXT_PUBLIC_SITE_URL;
      const session = await getStripe().checkout.sessions.create({
        mode: "payment",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: { name: "Encompass driver background check" },
          },
        }],
        customer_email: driver.email || user.email || undefined,
        client_reference_id: `bgfee_${driver.id}`,
        metadata: { kind: "background_fee", driver_id: driver.id, amount_cents: String(amount) },
        payment_intent_data: { metadata: { kind: "background_fee", driver_id: driver.id } },
        success_url: `${site}/driver?bgfee=done`,
        cancel_url: `${site}/driver`,
      });
      await db.from("drivers").update({ bg_fee_session_id: session.id }).eq("id", driver.id);
      return Response.json({ url: session.url });
    }

    return Response.json(statusOf(driver));
  } catch (err) {
    console.error("Background fee error:", err);
    return Response.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
