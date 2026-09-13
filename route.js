import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function verifySignature(rawBody, signatureHeader, notificationUrl) {
  const hmac = crypto.createHmac("sha256", process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
  hmac.update(notificationUrl + rawBody);
  const expected = hmac.digest("base64");
  return expected === signatureHeader;
}

function toSnakeCasePatch(ride) {
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
    status: "requested",
    created_at: new Date().toISOString(),
  };
}

export async function POST(request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-square-hmacsha256-signature");
  const notificationUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/square-webhook`;

  if (!signatureHeader || !verifySignature(rawBody, signatureHeader, notificationUrl)) {
    console.error("Square webhook: signature mismatch — rejecting.");
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.type !== "payment.updated") {
    return Response.json({ received: true });
  }

  const payment = event.data?.object?.payment;
  if (!payment || payment.status !== "COMPLETED") {
    return Response.json({ received: true });
  }

  try {
    // Look up the order to get our reference_id (the booking token)
    const orderRes = await fetch(`https://connect.squareup.com/v2/orders/${payment.order_id}`, {
      headers: {
        "Square-Version": "2024-06-20",
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      },
    });
    const orderData = await orderRes.json();
    const token = orderData.order?.reference_id;
    if (!token) {
      console.error("Square webhook: no reference_id on order", payment.order_id);
      return Response.json({ received: true });
    }

    const { data: booking, error: fetchError } = await supabase
      .from("pending_bookings")
      .select("*")
      .eq("token", token)
      .single();

    if (fetchError || !booking) {
      console.error("Square webhook: no pending booking found for token", token);
      return Response.json({ received: true });
    }

    if (booking.ride_id) {
      // Already processed (Square can send duplicate webhook deliveries) —
      // safe to just acknowledge and stop.
      return Response.json({ received: true });
    }

    // Sanity check: the amount actually paid should match what we quoted.
    const paidCents = payment.amount_money?.amount || 0;
    const expectedCents = Math.round(Number(booking.fare) * 100);
    if (paidCents !== expectedCents) {
      console.error("Square webhook: amount mismatch", { paidCents, expectedCents, token });
      return Response.json({ received: true });
    }

    // Payment confirmed — NOW the ride actually gets created.
    const { data: newRide, error: insertError } = await supabase
      .from("rides")
      .insert(toSnakeCasePatch(booking.ride_data))
      .select()
      .single();

    if (insertError) {
      console.error("Square webhook: failed to create ride", insertError);
      return Response.json({ received: true });
    }

    await supabase.from("pending_bookings").update({ ride_id: newRide.id }).eq("token", token);

    return Response.json({ received: true, rideId: newRide.id });
  } catch (err) {
    console.error("Square webhook error:", err);
    return Response.json({ received: true });
  }
}
