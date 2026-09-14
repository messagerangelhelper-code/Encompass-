import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const body = await request.json();
    const { fare } = body;

    if (!fare || fare <= 0) {
      return Response.json({ error: "Invalid fare amount" }, { status: 400 });
    }

    const amountInCents = Math.round(fare * 100);
    const token = crypto.randomUUID();

    const rideData = {
      riderName: body.riderName || "Rider",
      riderUid: body.riderUid || crypto.randomUUID(),
      destination: body.destination || "",
      fare: body.fare,
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
    };

    const { error: insertError } = await supabase.from("pending_bookings").insert({
      token, ride_data: rideData, fare: body.fare,
    });
    if (insertError) {
      console.error("Pending booking insert error:", insertError);
      return Response.json({ error: "Couldn't set up booking" }, { status: 500 });
    }

    const linkRes = await fetch("https://connect.squareup.com/v2/online-checkout/payment-links", {
      method: "POST",
      headers: {
        "Square-Version": "2024-06-20",
        "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotency_key: `link-${token}`,
        order: {
          location_id: process.env.SQUARE_LOCATION_ID,
          reference_id: token,
          line_items: [
            {
              name: `Encompass Rideshare — ${body.destination || "Ride"}`,
              quantity: "1",
              base_price_money: { amount: amountInCents, currency: "USD" },
            },
          ],
        },
        checkout_options: {
          redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}${body.returnTo || "/rider"}?payment=pending&token=${token}`,
        },
      }),
    });
    const linkData = await linkRes.json();
    if (!linkRes.ok) {
      console.error("Square payment link error:", linkData);
      return Response.json({ error: linkData.errors?.[0]?.detail || "Couldn't create payment link" }, { status: 500 });
    }

    return Response.json({ url: linkData.payment_link.url });
  } catch (err) {
    console.error("Payment link error:", err);
    return Response.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
