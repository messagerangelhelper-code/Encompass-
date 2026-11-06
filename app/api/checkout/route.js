    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountInCents,
          product_data: { name: `Encompass Rideshare: ${body.destination || "Ride"}`.slice(0, 250) },
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
