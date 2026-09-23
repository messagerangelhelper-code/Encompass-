"use client";
import { useState, useEffect } from "react";
import CityMap from "../CityMap";
import ChatPanel from "../ChatPanel";
import { ACCENT } from "../../lib/tokens";
import {
  sendMagicLinkRider, completeMagicLinkSignInRider,
  createRide, subscribeToRide, rateDriver,
} from "../../lib/supabase-db";
import { fareForTrip } from "../../lib/fare";

export default function RiderPage() {
  const [rider, setRider] = useState(null);
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [destination, setDestination] = useState("");
  const [miles, setMiles] = useState("3");
  const [minutes, setMinutes] = useState("12");

  const [ride, setRide] = useState(null);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    completeMagicLinkSignInRider().then((r) => { if (r) setRider(r); });
  }, []);

  useEffect(() => {
    if (!ride?.id) return;
    const unsub = subscribeToRide(ride.id, setRide);
    return unsub;
  }, [ride?.id]);

  const sendMagicLink = async () => {
    setAuthError("");
    if (!email) {
      setAuthError("Enter your email first.");
      return;
    }
    try {
      await sendMagicLinkRider(email);
      setMagicLinkSent(true);
    } catch (err) {
      setAuthError(err.message || "Couldn't send magic link.");
    }
  };

  const requestRide = async (e) => {
    e.preventDefault();
    const fare = fareForTrip(Number(miles), Number(minutes));
    const rideId = await createRide({
      riderUid: rider.uid,
      riderName: rider.name,
      destination,
      fare,
      miles: Number(miles),
      minutes: Number(minutes),
      vehicleType: "standard",
      pickupLocation: { lat: Number(pickupLat), lng: Number(pickupLng) },
      dropoffLocation: { lat: Number(dropoffLat), lng: Number(dropoffLng) },
    });
    setRide({ id: rideId, status: "requested", fare });
  };

  if (!rider) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "#111318" }}>
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "#F5F5F0" }}>Encompass</h1>
        <p className="text-sm" style={{ color: "#7A7F8A" }}>Rideshare, on your terms.</p>

        {authError && <p className="text-xs" style={{ color: "#ff6b6b" }}>{authError}</p>}
        {magicLinkSent && <p className="text-xs" style={{ color: ACCENT }}>Check your email for a login link.</p>}

        <button
          onClick={async () => {
            const enteredEmail = window.prompt("Enter your email to sign in:");
            if (!enteredEmail) return;
            setAuthError("");
            try {
              await sendMagicLinkRider(enteredEmail);
              setMagicLinkSent(true);
            } catch (err) {
              setAuthError(err.message || "Couldn't send magic link.");
            }
          }}
          className="w-full py-4 rounded-xl text-sm font-semibold"
          style={{ background: ACCENT, color: "#111318" }}
        >
          Encompass Rideshare
        </button>
      </div>
    </main>
  );
}

  if (!ride) {
    return (
      <main className="min-h-screen p-6" style={{ background: "#111318" }}>
        <h1 className="text-xl font-bold mb-4" style={{ color: "#F5F5F0" }}>Where to, {rider.name}?</h1>
        <form onSubmit={requestRide} className="space-y-3">
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination"
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          <div className="grid grid-cols-2 gap-2">
            <input value={pickupLat} onChange={(e) => setPickupLat(e.target.value)} placeholder="Pickup lat"
              className="px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
            <input value={pickupLng} onChange={(e) => setPickupLng(e.target.value)} placeholder="Pickup lng"
              className="px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
            <input value={dropoffLat} onChange={(e) => setDropoffLat(e.target.value)} placeholder="Dropoff lat"
              className="px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
            <input value={dropoffLng} onChange={(e) => setDropoffLng(e.target.value)} placeholder="Dropoff lng"
              className="px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          </div>
          <p className="text-xs" style={{ color: "#7A7F8A" }}>
            Est. fare: ${fareForTrip(Number(miles) || 0, Number(minutes) || 0).toFixed(2)}
          </p>
          <button type="submit" className="w-full py-3 rounded-xl text-sm font-semibold" style={{ background: ACCENT, color: "#111318" }}>
            Request Ride
          </button>
        </form>
      </main>
    );
  }

  const pickupPos = ride.pickup_location || (pickupLat && { lat: Number(pickupLat), lng: Number(pickupLng) });
  const dropoffPos = ride.dropoff_location || (dropoffLat && { lat: Number(dropoffLat), lng: Number(dropoffLng) });
  const driverPos = ride.driver_location;

  return (
    <main className="relative w-full h-screen" style={{ background: "#111318" }}>
      <CityMap pickupPos={pickupPos} dropoffPos={dropoffPos} driverPos={driverPos} showRoute />
      <div className="absolute top-6 left-4 right-4 p-4 rounded-xl" style={{ background: "#1D2028", border: "1px solid #2B2F3A" }}>
        <p className="text-sm font-semibold" style={{ color: "#F5F5F0" }}>Status: {ride.status}</p>
        {ride.status === "requested" && <p className="text-xs mt-1" style={{ color: "#7A7F8A" }}>Looking for a driver…</p>}
        {ride.driver_name && <p className="text-xs mt-1" style={{ color: "#7A7F8A" }}>Driver: {ride.driver_name}</p>}
        {(ride.status === "accepted" || ride.status === "in_progress") && (
          <button onClick={() => setShowChat(true)} className="mt-2 text-xs font-semibold" style={{ color: ACCENT }}>
            Open chat
          </button>
        )}
        {ride.status === "completed" && (
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => rateDriver(ride.id, ride.driver_uid, n)} className="text-lg">⭐</button>
            ))}
          </div>
        )}
      </div>
      {showChat && (
        <ChatPanel rideId={ride.id} mySender="rider" otherName={ride.driver_name || "Driver"}
          quickReplies={["On my way", "Running 5 min late", "I'm here"]} onClose={() => setShowChat(false)} />
      )}
    </main>
  );
}

