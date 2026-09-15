"use client";
import { useState, useEffect } from "react";
import { MapPin, Search, Car, Check, Clock, Phone, Send } from "lucide-react";
import CityMap from "../../components/CityMap";
import { ACCENT, AMBER } from "../../lib/tokens";
import { fareForTrip } from "../../lib/fare";
import { VEHICLE_TYPES } from "../../lib/vehicleTypes";
import { subscribeToRide, getPendingBooking } from "../../lib/supabase-db";
import HowToBookModal from "../../components/HowToBookModal";
// Hotels in Ennis, TX and Waxahachie, TX — selecting one auto-fills pickup
// address so guests don't need to know or type their own location.
const HOTELS = [
  { name: "Quality Inn (Ennis)", address: "107 Chamber Of Commerce Dr, Ennis, TX 75119" },
  { name: "Comfort Suites Ennis", address: "400 S Interstate Highway 45, Ennis, TX 75119" },
  { name: "Motel 6 (Ennis)", address: "100 S Interstate Highway 45, Ennis, TX 75119" },
  { name: "Budget Inn (Ennis)", address: "3900 S Interstate Highway 45, Ennis, TX 75119" },
  { name: "Geneva Inn Motel (Ennis)", address: "507 S Kaufman St, Ennis, TX 75119" },
  { name: "Baymont Inn & Suites (Ennis)", address: "100 S Interstate Highway 45, Ennis, TX 75119" },
  { name: "Hampton Inn & Suites (Waxahachie)", address: "2010 Civic Center Ln, Waxahachie, TX 75165" },
  { name: "Comfort Suites Waxahachie", address: "131 Rvg Pkwy, Waxahachie, TX 75165" },
  { name: "Holiday Inn Express & Suites (Waxahachie)", address: "984 W Highway 287 Byp, Waxahachie, TX 75165" },
  { name: "Fairfield Inn & Suites (Waxahachie)", address: "2020 Civic Center Ln, Waxahachie, TX 75165" },
  { name: "Rogers Hotel (Waxahachie)", address: "100 N College St, Waxahachie, TX 75165" },
  { name: "La Quinta (Waxahachie)", address: "311 Stadium Dr, Waxahachie, TX 75165" },
  { name: "Best Western Plus Waxahachie Inn & Suites", address: "1701 N Highway 77, Waxahachie, TX 75165" },
  { name: "Super 8 by Wyndham (Waxahachie)", address: "400 N Interstate Highway 35 E, Waxahachie, TX 75165" },
  { name: "Residence Inn by Marriott (Waxahachie)", address: "275 Rae Blvd, Waxahachie, TX 75165" },
  { name: "Knights Inn (Waxahachie)", address: "803 S Interstate Highway 35 E, Waxahachie, TX 75165" },
  { name: "American Inn & Suites (Waxahachie)", address: "795 S Interstate Highway 35 E, Waxahachie, TX 75165" },
  { name: "Sleep Inn (Waxahachie)", address: "1701 N Highway 77, Waxahachie, TX 75165" },
  { name: "Texas Inns (Waxahachie)", address: "3381 S Interstate Highway 35 E, Waxahachie, TX 75165" },
  { name: "Brown's Motel (Waxahachie)", address: "107 N Highway 77, Waxahachie, TX 75165" },
];

async function geocodeAddress(query, biasNear) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const proximity = biasNear ? `&proximity=${biasNear.lng},${biasNear.lat}` : "";
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1&country=US${proximity}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't look up that address.");
  const data = await res.json();
  const feature = data.features && data.features[0];
  if (!feature) throw new Error("Couldn't find that address — try being more specific.");
  const [lng, lat] = feature.center;
  return { lat, lng, placeName: feature.place_name };
}

async function getDrivingRoute(pickup, dropoff) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?access_token=${token}&overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't calculate the route.");
  const data = await res.json();
  const route = data.routes && data.routes[0];
  if (!route) throw new Error("Couldn't find a driving route to that address.");
  const miles = Math.round((route.distance / 1609.34) * 10) / 10;
  const minutes = Math.round(route.duration / 60);
  return { miles, minutes };
}

// ---------- Booking form ----------
function HotelBookingForm({ onBooked }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hotelIndex, setHotelIndex] = useState("");
  const [dest, setDest] = useState("");
  const [vehicle, setVehicle] = useState("standard");
  const [pickupLoc, setPickupLoc] = useState(null);
  const [pickupError, setPickupError] = useState("");
  const [dropoffLoc, setDropoffLoc] = useState(null);
  const [realTrip, setRealTrip] = useState(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaNums] = useState(() => ({
    a: Math.floor(Math.random() * 8) + 2,
    b: Math.floor(Math.random() * 8) + 2,
  }));

  const selectedHotel = hotelIndex !== "" ? HOTELS[hotelIndex] : null;
  const selectedVehicle = VEHICLE_TYPES.find((v) => v.id === vehicle);
  const baseFare = realTrip ? fareForTrip(realTrip.miles, realTrip.minutes) : 0;
  const finalFare = baseFare * selectedVehicle.multiplier;

  const phonePattern = /^[\d\s\-\(\)\+]{10,}$/;
  const phoneValid = phonePattern.test(phone.trim());
  const captchaValid = Number(captchaAnswer) === captchaNums.a + captchaNums.b;

  // Once a hotel is picked, geocode its address to get real pickup coordinates.
  useEffect(() => {
    setPickupLoc(null);
    setPickupError("");
    if (!selectedHotel) return;
    geocodeAddress(selectedHotel.address)
      .then(setPickupLoc)
      .catch((err) => setPickupError(err.message || "Couldn't locate that hotel."));
  }, [hotelIndex]);

  useEffect(() => {
    setRealTrip(null);
    setDropoffLoc(null);
    setTripError("");
    if (!dest.trim() || dest.trim().length < 4 || !pickupLoc) return;

    let cancelled = false;
    setTripLoading(true);
    const timer = setTimeout(async () => {
      try {
        const loc = await geocodeAddress(dest.trim(), pickupLoc);
        const route = await getDrivingRoute(pickupLoc, loc);
        if (route.miles > 100) {
          throw new Error("That address seems too far away — try adding the city and state (e.g. \"DFW Airport, Dallas TX\") and search again.");
        }
        if (!cancelled) {
          setDropoffLoc(loc);
          setRealTrip(route);
        }
      } catch (err) {
        if (!cancelled) setTripError(err.message || "Couldn't find that address.");
      } finally {
        if (!cancelled) setTripLoading(false);
      }
    }, 700);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [dest, pickupLoc]);

  const canConfirm = name.trim() && phoneValid && selectedHotel && pickupLoc && dest.trim() && !!realTrip && captchaValid && !confirming;

  const handleConfirm = async () => {
    setConfirmError("");
    if (!canConfirm) {
      setConfirmError("Fill in your name, a valid phone number, hotel, destination, and the answer above.");
      return;
    }
    setConfirming(true);

    // The ride is NOT created here — only after payment succeeds and Square
    // sends the guest back with these details in the URL. This prevents a
    // driver from ever seeing/accepting a ride that hasn't been paid for.
    try {
      const res = await fetch("/api/create-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riderName: name.trim(), riderUid: crypto.randomUUID(),
          destination: dest.trim(), fare: finalFare,
          miles: realTrip?.miles || 0, minutes: realTrip?.minutes || 0,
          vehicleType: vehicle, isFamilyRide: false, riderRecording: false,
          pickupLat: pickupLoc.lat, pickupLng: pickupLoc.lng,
          dropoffLat: dropoffLoc?.lat, dropoffLng: dropoffLoc?.lng,
          guestPhone: phone.trim(), pickupHotel: selectedHotel.name,
          returnTo: "/hotel",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      } else {
        setConfirmError("Payment setup failed: " + (data.error || "unknown reason"));
        setConfirming(false);
      }
    } catch (err) {
      setConfirmError("Couldn't set up payment — please try again.");
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col px-6 py-8" style={{ background: "#111318" }}>
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight mb-1" style={{ color: "#F5F5F0" }}>Encompass Rideshare</h1>
        <p className="text-sm mb-6" style={{ color: "#7A7F8A" }}>Book a ride from your hotel — to the airport or anywhere around town.</p>
      <p className="text-sm mb-6" style={{ color: "#7A7F8A" }}>Book a ride from your hotel — to the airport or anywhere around town.</p>
      <div className="mb-6"><HowToBookModal phone="4693097655" /></div>
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
            name="name" autoComplete="name"
            className="w-full px-4 py-3.5 rounded-xl text-base outline-none"
            style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" type="tel"
            name="phone" autoComplete="tel"
            className="w-full px-4 py-3.5 rounded-xl text-base outline-none"
            style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          {phone.trim() && !phoneValid && (
            <p className="text-xs" style={{ color: "#FF6B6B" }}>Enter a valid phone number (10+ digits).</p>
          )}
          <select value={hotelIndex} onChange={(e) => setHotelIndex(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl text-base outline-none"
            style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }}>
            <option value="">Which hotel are you at?</option>
            {HOTELS.map((h, i) => (
              <option key={h.name} value={i}>{h.name}</option>
            ))}
          </select>
          {pickupError && <p className="text-sm" style={{ color: "#FF6B6B" }}>{pickupError}</p>}

          {selectedHotel && pickupLoc && (
            <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Where are you headed?"
              name="destination" autoComplete="off" autoCorrect="off" spellCheck="false"
              className="w-full px-4 py-3.5 rounded-xl text-base outline-none"
              style={{ background: "#1D2028", color: "#F5F5F0", border: `1.5px solid ${ACCENT}` }} />
          )}

          {dest.trim() && tripLoading && !realTrip && (
            <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "#1D2028" }}>
              <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
              <p className="text-sm" style={{ color: "#7A7F8A" }}>Finding the route…</p>
            </div>
          )}
          {tripError && !tripLoading && <p className="text-sm" style={{ color: "#FF6B6B" }}>{tripError}</p>}

          {realTrip && (
            <>
              <div>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: "#7A7F8A" }}>Choose a ride</p>
                <div className="space-y-2">
                  {VEHICLE_TYPES.map((v) => {
                    const Icon = v.icon;
                    const isSelected = vehicle === v.id;
                    const price = (baseFare * v.multiplier).toFixed(2);
                    return (
                      <button key={v.id} onClick={() => setVehicle(v.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl transition"
                        style={{ background: isSelected ? ACCENT : "#1D2028", border: isSelected ? `1.5px solid ${ACCENT}` : "1px solid #2B2F3A" }}>
                        <Icon size={20} color={isSelected ? "#111318" : "#7A7F8A"} />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold" style={{ color: isSelected ? "#111318" : "#F5F5F0" }}>{v.name}</p>
                          <p className="text-xs" style={{ color: isSelected ? "#1D2028" : "#7A7F8A" }}>{v.note}</p>
                        </div>
                        <p className="text-sm font-semibold" style={{ color: isSelected ? "#111318" : AMBER }}>${price}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: "#1D2028" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#F5F5F0" }}>{selectedVehicle.name} estimate</p>
                  <p className="text-xs mt-0.5" style={{ color: "#7A7F8A" }}>{realTrip.miles} mi · ~{realTrip.minutes} min</p>
                </div>
                <p className="text-xl font-semibold" style={{ color: ACCENT }}>${finalFare.toFixed(2)}</p>
              </div>
            </>
          )}

          {realTrip && (
            <div>
              <label className="text-xs" style={{ color: "#7A7F8A" }}>
                Quick check: what's {captchaNums.a} + {captchaNums.b}?
              </label>
              <input value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)}
                inputMode="numeric" placeholder="Your answer"
                className="w-full mt-1 px-4 py-3 rounded-xl text-base outline-none"
                style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
            </div>
          )}

          {confirmError && <p className="text-sm" style={{ color: "#FF6B6B" }}>{confirmError}</p>}
          <button disabled={!canConfirm} onClick={handleConfirm}
            className="w-full py-3.5 rounded-xl font-medium text-base disabled:opacity-40"
            style={{ background: ACCENT, color: "#111318" }}>
            {confirming ? "Setting up payment…" : realTrip ? `Book & Pay • $${finalFare.toFixed(2)}` : "Enter your destination"}
          </button>
        </div>

        <div className="mt-8 flex gap-2">
          <a href="tel:+14693097655"
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl"
            style={{ background: "#1D2028" }}>
            <Phone size={18} color={ACCENT} />
            <span className="text-xs font-medium" style={{ color: "#F5F5F0" }}>Call</span>
          </a>
          <a href="https://t.me/Chris" target="_blank" rel="noopener noreferrer"
            className="flex-1 flex flex-col items-center gap-1 py-3 rounded-xl"
            style={{ background: "#1D2028" }}>
            <Send size={18} color={ACCENT} />
            <span className="text-xs font-medium" style={{ color: "#F5F5F0" }}>Telegram</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------- Tracking (after booking / after payment) ----------
function HotelTrackingScreen({ rideId }) {
  const [ride, setRide] = useState(null);

  useEffect(() => {
    const unsub = subscribeToRide(rideId, setRide);
    return unsub;
  }, [rideId]);

  const status = ride?.status || "requested";
  const statusText = {
    requested: "Finding you a driver…",
    accepted: "Your driver is on the way",
    arrived_pickup: "Your driver has arrived — head down!",
    in_progress: `Heading to ${ride?.destination || "your destination"}`,
    completed: "Ride complete — thank you!",
    cancelled: "This ride was cancelled.",
  }[status];

  const driverPos = ride?.driver_location ? { lat: ride.driver_location.lat, lng: ride.driver_location.lng } : null;
  const pickupPos = ride?.pickup_location || null;
  const dropoffPos = ride?.dropoff_location || null;

  return (
    <div className="w-full h-screen relative">
      <CityMap driverPos={driverPos} pickupPos={pickupPos} dropoffPos={dropoffPos} showRoute={status !== "requested"} />
      <div className="absolute top-4 left-4 right-4">
        <div className="px-4 py-2.5 rounded-full flex items-center gap-2" style={{ background: "rgba(17,19,24,0.85)", border: "1px solid #2B2F3A" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: AMBER }} />
          <span className="text-sm" style={{ color: "#F5F5F0" }}>{statusText}</span>
        </div>
      </div>
      {ride?.driver_name && (
        <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-5 pb-8" style={{ background: "#F5F5F0" }}>
          <div className="w-9 h-1 rounded-full mx-auto mb-5" style={{ background: "#D8D6CE" }} />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: ACCENT }}>
              <Car size={20} color="#111318" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ color: "#111318" }}>{ride.driver_name}</p>
              <p className="text-xs" style={{ color: "#7A7F8A" }}>{ride.car_model}{ride.plate ? ` · ${ride.plate}` : ""}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Root ----------
export default function HotelPortal() {
  const [rideId, setRideId] = useState(null);
  const [checkedUrl, setCheckedUrl] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (params.get("payment") !== "pending" || !token) {
      setCheckedUrl(true);
      return;
    }

    window.history.replaceState({}, "", "/hotel");

    let attempts = 0;
    const maxAttempts = 20; // ~30 seconds total
    const poll = async () => {
      attempts++;
      const booking = await getPendingBooking(token);
      if (booking?.ride_id) {
        setRideId(booking.ride_id);
        setCheckedUrl(true);
        return;
      }
      if (attempts >= maxAttempts) {
        setError("Confirming your payment is taking longer than expected. If you were charged, your ride will appear shortly — otherwise use the Call or Telegram button below.");
        setCheckedUrl(true);
        return;
      }
      setTimeout(poll, 1500);
    };
    poll();
  }, []);

  if (!checkedUrl) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center px-8 text-center" style={{ background: "#111318" }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin mb-4" style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
        <p style={{ color: "#F5F5F0" }}>Confirming your payment…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center px-8 text-center" style={{ background: "#111318" }}>
        <p className="text-sm" style={{ color: "#FF6B6B" }}>{error}</p>
      </div>
    );
  }

  if (rideId) {
    return <HotelTrackingScreen rideId={rideId} />;
  }

  return <HotelBookingForm onBooked={setRideId} />;
}
