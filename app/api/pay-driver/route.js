import { getStripe, userFromRequest, payDriverForRide } from "../../../lib/stripeServer";
import { rateLimit } from "../../../lib/rateLimit";

// Called by the driver app right after a ride is marked completed.
// Body: { rideId }. Pays the driver's share from that ride's fare.
const RATE_LIMIT = { limit: 20, windowMs: 60_000, keyPrefix: "pay-driver" };

export async function POST(request) {
  try {
    const limited = rateLimit(request, RATE_LIMIT);
    if (limited) return limited;

    const { supabase, user } = await userFromRequest(request);
    if (!user) return Response.json({ error: "Sign in again." }, { status: 401 });

    const { rideId } = await request.json().catch(() => ({}));
    if (!rideId) return Response.json({ error: "Missing ride." }, { status: 400 });

    const { data: ride } = await supabase.from("rides").select("*").eq("id", rideId).single();
    if (!ride || ride.driver_uid !== user.id) return Response.json({ error: "Ride not found." }, { status: 404 });
    const { data: driver } = await supabase
      .from("drivers").select("id, stripe_account_id, payout_setup_complete").eq("id", user.id).single();
    const result = await payDriverForRide(getStripe(), supabase, ride, driver);
    return Response.json(result);
  } catch (err) {
    console.error("Pay driver error:", err);
    return Response.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
