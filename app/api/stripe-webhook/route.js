import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Stripe calls this after a rider pays. Only then is the real ride created.
// In Stripe: Developers > Webhooks > add endpoint
//   <your site>/api/stripe-webhook   event: checkout.session.completed
// and put its signing secret in STRIPE_WEBHOOK_SECRET on Render.

function toRideRow(ride, paymentIntentId) {
  return {
    rider_uid: ride.riderUid,
    rider_name: ride.riderName,
    destination: ride.destination,
    vehicle_type: ride.vehicleType || "standard",
    fare: ride.fare,
    miles: ride.miles,
    minutes: ride.minutes,
    is_family_ride: ride.isFamilyRide || false,
    rider_recording: ride.riderRecording || false,
    payment_method: ride.paymentMethod || "card",
    pickup_location: ride.pickupLocation || null,
    dropoff_location: ride.dropoffLocation || null,
    guest_phone: ride.guestPhone || null,
    pickup_hotel: ride.pickupHotel || null,
    stripe_payment_intent: paymentIntentId,
    status: "requested",
    created_at: new Date().toISOString(),
  };
}
export async function POST(request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook: bad signature", err.message);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }
  const session = event.data.object;
  if (session.payment_status !== "paid") return Response.json({ received: true });
  const token = session.metadata?.token || session.client_reference_id;
  if (!token) return Response.json({ received: true });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  try {
    const { data: booking } = await supabase
      .from("pending_bookings").select("*").eq("token", token).single();
    if (!booking) {
      console.error("Stripe webhook: no pending booking for token", token);
      return Response.json({ received: true });
    }
    if (booking.ride_id) return Response.json({ received: true });
    const expectedCents = Math.round(Number(booking.fare) * 100);
    if (session.amount_total !== expectedCents) {
      console.error("Stripe webhook: amount mismatch", { paid: session.amount_total, expectedCents, token });
      return Response.json({ received: true });
    }
    const { data: newRide, error: insertError } = await supabase
      .from("rides").insert(toRideRow(booking.ride_data, session.payment_intent)).select().single();
    if (insertError) {
      console.error("Stripe webhook: failed to create ride", insertError);
      return Response.json({ error: "Couldn't create ride" }, { status: 500 }); // Stripe will retry
    }
    await supabase.from("pending_bookings").update({ ride_id: newRide.id }).eq("token", token);
    return Response.json({ received: true, rideId: newRide.id });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return Response.json({ error: "Webhook error" }, { status: 500 });
  }
}
