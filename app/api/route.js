import { getStripe, userFromRequest } from "../../../lib/stripeServer";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { rateLimit } from "../../../lib/rateLimit";

// Cancels a ride that no driver has accepted yet and refunds the rider in full.
// Callers: the rider who booked it, or a driver declining it.
// Body: { rideId }
const RATE_LIMIT = { limit: 10, windowMs: 60_000, keyPrefix: "cancel-ride" };

export async function POST(request) {
  try {
    const limited = rateLimit(request, RATE_LIMIT);
    if (limited) return limited;

    const { supabase, user } = await userFromRequest(request);
    if (!user) return Response.json({ error: "Sign in again." }, { status: 401 });

    const { rideId } = await request.json().catch(() => ({}));
    if (!rideId) return Response.json({ error: "Missing ride." }, { status: 400 });

    const { data: ride } = await supabase.from("rides").select("*").eq("id", rideId).single();
    if (!ride) return Response.json({ error: "Ride not found." }, { status: 404 });
    let allowed = ride.rider_uid === user.id;
    if (!allowed) {
      const { data: driver } = await supabase.from("drivers").select("id").eq("id", user.id).single();
      allowed = !!driver;
    }
    if (!allowed) return Response.json({ error: "Not your ride." }, { status: 403 });
    if (ride.status !== "requested") {
      return Response.json({ error: "A driver already has this ride." }, { status: 409 });
    }
    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin
      .from("rides").update({ status: "cancelled" }).eq("id", rideId).eq("status", "requested");
    if (updateError) throw updateError;
    if (ride.stripe_payment_intent && !ride.refunded) {
      await getStripe().refunds.create(
        { payment_intent: ride.stripe_payment_intent },
        { idempotencyKey: `ride-refund-${rideId}` }
      );
      await admin.from("rides").update({ refunded: true }).eq("id", rideId);
    }
    return Response.json({ cancelled: true, refunded: !!ride.stripe_payment_intent });
  } catch (err) {
    console.error("Cancel ride error:", err);
    return Response.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
