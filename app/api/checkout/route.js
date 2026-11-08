import Stripe from "stripe";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";
import { userFromRequest } from "../../../lib/stripeServer";
import { rateLimit } from "../../../lib/rateLimit";
import { cleanDelivery, deliveryProblem } from "../../../lib/delivery";

// Creates a Stripe Checkout page for one ride. Nothing is written to the
// real `rides` table here: the ride is only created by /api/stripe-webhook
// once Stripe confirms the payment, so drivers never see an unpaid ride.

const RATE_LIMIT = { limit: 8, windowMs: 60_000, keyPrefix: "create-checkout" };
const MAX_FARE_USD = 2000;

export async function POST(request) {
  try {
    const limited = rateLimit(request, RATE_LIMIT);
    if (limited) return limited;

    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ error: "Payments aren't set up yet." }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = getSupabaseAdmin();
    // Admin turned the whole app off: no payments.
    const { data: siteRow } = await supabase.from("site_settings").select("site_enabled").eq("id", 1).maybeSingle();
    if (siteRow && siteRow.site_enabled === false) {
      return Response.json({ error: "Encompass is temporarily unavailable. Check back soon." }, { status: 503 });
    }
    const body = await request.json();
    const fare = Number(body.fare);
    if (!fare || fare <= 0 || fare > MAX_FARE_USD) {
      return Response.json({ error: "Invalid fare amount" }, { status: 400 });
    }
    // Package deliveries carry the package and recipient details with them.
    let delivery = null;
    if (body.vehicleType === "package") {
      delivery = cleanDelivery(body.delivery);
      const problem = deliveryProblem(delivery);
      if (problem) return Response.json({ error: problem }, { status: 400 });
    }
    // Rider app bookings must come from the signed-in rider, and a rider the
    // admin turned off can't book. Hotel guests aren't signed in.
    const returnTo = body.returnTo === "/hotel" ? "/hotel" : "/rider";
    let riderUid = body.riderUid || crypto.randomUUID();
    if (returnTo === "/rider") {
      const { user } = await userFromRequest(request);
      if (!user) return Response.json({ error: "Please sign in again, then book." }, { status: 401 });
      riderUid = user.id;
      const { data: riderRow } = await supabase.from("riders").select("account_off").eq("id", user.id).maybeSingle();
      if (riderRow?.account_off) {
        return Response.json({ error: "Your account is turned off. Please contact Encompass." }, { status: 403 });
      }
    }
    const amountInCents = Math.round(fare * 100);
    const token = crypto.randomUUID();
    const rideData = {
      riderName: body.riderName || "Rider",
      riderUid,
      destination: body.destination || "",
      fare,
      miles: body.miles || 0,
      minutes: body.minutes || 0,
      vehicleType: body.vehicleType || "standard",
      isFamilyRide: !!body.isFamilyRide,
      riderRecording: !!body.riderRecording,
      paymentMethod: "card",
      pickupLocation: body.pickupLat != null ? { lat: body.pickupLat, lng: body.pickupLng } : null,
      dropoffLocation: body.dropoffLat != null ? { lat: body.dropoffLat, lng: body.dropoffLng } : null,
      guestPhone: body.guestPhone || null,
      pickupHotel: body.pickupHotel || null,
      delivery,
    };
    const { error: insertError } = await supabase.from("pending_bookings").insert({
      token, ride_data: rideData, fare,
    });
    if (insertError) {
      console.error("Pending booking insert error:", insertError);
      return Response.json({ error: "Couldn't set up booking" }, { status: 500 });
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountInCents,
          product_data: { name: `${delivery ? "Encompass Package Delivery" : "Encompass Rideshare"}: ${body.destination || "Ride"}`.slice(0, 250) },
        },
      }],
      client_reference_id: token,
      metadata: { token },
      payment_intent_data: { metadata: { token } },
      success_url: `${site}${returnTo}?payment=pending&token=${token}`,
      cancel_url: `${site}${returnTo}`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return Response.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
