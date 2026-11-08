"use client";
import { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, Search, X, MessageCircle, Star, Package } from "lucide-react";
import CityMap from "../../components/CityMap";
import ChatPanel from "../../components/ChatPanel";
import ReportProblem from "../../components/ReportProblem";
import { ACCENT, AMBER } from "../../lib/tokens";
import {
  sendMagicLinkRider, completeMagicLinkSignInRider,
  subscribeToRide, rateDriver, updateRide, getPendingBooking, getSiteSettings,
} from "../../lib/supabase-db";
import { authPost } from "../../lib/authPost";
import { supabase } from "../../lib/supabase";
import { fareForTrip } from "../../lib/fare";
import { VEHICLE_TYPES } from "../../vehicleTypes";
import { PACKAGE_SIZES, NOT_ALLOWED, cleanDelivery, deliveryProblem, isPackageRide, deliveryPhotoLink } from "../../lib/delivery";
export const dynamic = "force-dynamic";

const DARK = "#111318", CARD = "#1D2028", LINE = "#2B2F3A", TEXT = "#F5F5F0", MUTED = "#7A7F8A";
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ---------- Mapbox helpers (same service the hotel booking uses) ----------
async function searchPlaces(query, near) {
  if (!query || query.trim().length < 3) return [];
  const proximity = near ? `&proximity=${near.lng},${near.lat}` : "";
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${TOKEN}&limit=5&country=US&types=address,poi,place,neighborhood${proximity}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features || []).map((f) => ({ lat: f.center[1], lng: f.center[0], name: f.text, label: f.place_name }));
}
async function placeName(pos) {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${pos.lng},${pos.lat}.json?access_token=${TOKEN}&limit=1&types=address,poi`;
    const data = await (await fetch(url)).json();
    return data.features?.[0]?.place_name || "Current location";
  } catch {
    return "Current location";
  }
}
async function drivingRoute(a, b) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${a.lng},${a.lat};${b.lng},${b.lat}?access_token=${TOKEN}&overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't work out the route.");
  const route = (await res.json()).routes?.[0];
  if (!route) throw new Error("No driving route found to that place.");
  return { miles: Math.round((route.distance / 1609.34) * 10) / 10, minutes: Math.max(1, Math.round(route.duration / 60)) };
}
const short = (label) => String(label || "").split(",").slice(0, 2).join(",");
// ---------- Address box with suggestions ----------
function PlaceInput({ icon: Icon, iconColor, placeholder, value, onPick, near, autoFocus, extra }) {
  const [text, setText] = useState(value?.label ? short(value.label) : "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  useEffect(() => { setText(value?.label ? short(value.label) : ""); }, [value?.label]);
  const onType = (v) => {
    setText(v); setOpen(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => setResults(await searchPlaces(v, near)), 300);
  };
  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 rounded-xl" style={{ background: CARD, border: `1px solid ${LINE}` }}>
        <Icon size={16} color={iconColor} />
        <input value={text} onChange={(e) => onType(e.target.value)} onFocus={() => setOpen(true)} placeholder={placeholder}
          autoFocus={autoFocus} autoComplete="off" aria-label={placeholder}
          className="flex-1 py-3.5 text-base outline-none bg-transparent" style={{ color: TEXT }} />
        {text && (
          <button type="button" aria-label="Clear" onClick={() => { setText(""); setResults([]); onPick(null); }}>
            <X size={16} color={MUTED} />
          </button>
        )}
      </div>
      {open && (results.length > 0 || extra) && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden" style={{ background: CARD, border: `1px solid ${LINE}`, boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
          {extra && <div onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(false)}>{extra}</div>}
          {results.map((r, i) => (
            <button type="button" key={i} onClick={() => { onPick(r); setText(short(r.label)); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2" style={{ borderTop: i || extra ? `1px solid ${LINE}` : "none" }}>
              <MapPin size={15} color={MUTED} className="mt-0.5 flex-shrink-0" />
              <span>
                <span className="block text-sm" style={{ color: TEXT }}>{r.name}</span>
                <span className="block text-xs" style={{ color: MUTED }}>{r.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ---------- Sign in ----------
function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Enter a valid email address."); return; }
    setBusy(true);
    try { await sendMagicLinkRider(email.trim().toLowerCase()); setSent(true); }
    catch (err) { setError(err.message || "Couldn't send the sign-in link."); }
    setBusy(false);
  };
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: DARK }}>
      <form onSubmit={send} className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-3xl font-bold" style={{ color: TEXT }}>Encompass</h1>
        <p className="text-sm" style={{ color: MUTED }}>Rides, deliveries and hauling, on your terms.</p>
        {sent ? (
          <p className="text-sm rounded-xl p-4" style={{ background: CARD, color: ACCENT }}>
            Check your email for a sign-in link, then tap it on this phone.
          </p>
        ) : (
          <>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" type="email" autoComplete="email"
              className="w-full px-4 py-3.5 rounded-xl text-base text-center outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${LINE}` }} />
            {error && <p className="text-sm" style={{ color: "#FF6B6B" }}>{error}</p>}
            <button disabled={busy} className="w-full py-4 rounded-xl text-base font-semibold" style={{ background: ACCENT, color: DARK }}>
              {busy ? "Sending…" : "Send my sign-in link"}
            </button>
            <p className="text-xs" style={{ color: MUTED }}>No password needed. We email you a link.</p>
          </>
        )}
      </form>
    </main>
  );
}
// ---------- Package details (shown when "Packages" is picked) ----------
function PackageForm({ form, set }) {
  const box = { background: CARD, color: TEXT, border: `1px solid ${LINE}` };
  const field = "w-full px-3 py-3 rounded-xl text-base outline-none";
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs uppercase tracking-wide" style={{ color: MUTED }}>Package details</p>
      <div className="flex gap-2">
        {PACKAGE_SIZES.map((sz) => {
          const on = form.size === sz.id;
          return (
            <button type="button" key={sz.id} onClick={() => set("size", sz.id)} aria-pressed={on}
              className="flex-1 p-2.5 rounded-xl text-left" style={{ background: on ? ACCENT : CARD, border: `1px solid ${on ? ACCENT : LINE}` }}>
              <span className="block text-sm font-semibold" style={{ color: on ? DARK : TEXT }}>{sz.name}</span>
              <span className="block text-xs" style={{ color: on ? CARD : MUTED }}>{sz.note}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs" style={{ color: MUTED }}>Bigger than that? Pick Pickup Truck, Cargo Van or Box Truck instead.</p>
      <input value={form.contents} onChange={(e) => set("contents", e.target.value)} maxLength={120} placeholder="What's inside? (e.g. shoes, papers)" className={field} style={box} />
      <input value={form.recipientName} onChange={(e) => set("recipientName", e.target.value)} maxLength={80} placeholder="Who gets it? (name)" autoComplete="off" className={field} style={box} />
      <input value={form.recipientPhone} onChange={(e) => set("recipientPhone", e.target.value)} maxLength={20} placeholder="Their phone number" type="tel" autoComplete="off" className={field} style={box} />
      <input value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={200} placeholder="Drop-off note (optional, e.g. leave at back door)" className={field} style={box} />
      <label className="flex items-start gap-2 p-3 rounded-xl" style={{ background: CARD, border: `1px solid ${LINE}` }}>
        <input type="checkbox" checked={form.noProhibitedItems} onChange={(e) => set("noProhibitedItems", e.target.checked)} className="mt-1" />
        <span className="text-xs" style={{ color: TEXT }}>My package has none of these: {NOT_ALLOWED.join(", ").toLowerCase()}.</span>
      </label>
      <p className="text-xs" style={{ color: MUTED }}>Your driver takes a photo at pickup and where they leave it.</p>
    </div>
  );
}
// ---------- Book a ride ----------
function BookRide({ rider, onBooked }) {
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [near, setNear] = useState(null);
  const [locating, setLocating] = useState(false);
  const [trip, setTrip] = useState(null);
  const [vehicle, setVehicle] = useState("standard");
  const [pkgForm, setPkgForm] = useState({ size: "small", contents: "", recipientName: "", recipientPhone: "", notes: "", noProhibitedItems: false });
  const setPkg = (k, v) => setPkgForm((f) => ({ ...f, [k]: v }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const useMyLocation = () => {
    if (!("geolocation" in navigator)) { setError("This phone can't share its location. Type your pickup address instead."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setNear(pos);
        setPickup({ ...pos, label: await placeName(pos) });
        setLocating(false);
      },
      () => { setLocating(false); setError("Location is off. Allow location for this site, or type your pickup address."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  useEffect(() => { useMyLocation(); }, []);   // start with where they are
  useEffect(() => {
    setTrip(null);
    if (!pickup || !dropoff) return;
    setError("");
    drivingRoute(pickup, dropoff).then(setTrip).catch((e) => setError(e.message));
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);
  const priceFor = (v) => (trip ? fareForTrip(trip.miles, trip.minutes, v.multiplier) : 0);
  const chosen = VEHICLE_TYPES.find((v) => v.id === vehicle) || VEHICLE_TYPES[0];
  // The ride is NOT created here. The rider pays on Stripe first; once Stripe
  // confirms the payment, the webhook creates the ride and drivers can see it.
  const isPackage = chosen.id === "package";
  const request = async () => {
    if (!pickup || !dropoff || !trip) return;
    let delivery = null;
    if (isPackage) {
      delivery = cleanDelivery({ ...pkgForm, pickupLabel: pickup.label, dropoffLabel: dropoff.label });
      const problem = deliveryProblem(delivery);
      if (problem) { setError(problem); return; }
    }
    setBusy(true); setError("");
    try {
      const fare = priceFor(chosen);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token || ""}` },
        body: JSON.stringify({
          riderName: rider.name, riderUid: rider.uid,
          destination: short(dropoff.label), fare,
          miles: trip.miles, minutes: trip.minutes, vehicleType: chosen.id,
          isFamilyRide: false, riderRecording: false,
          pickupLat: pickup.lat, pickupLng: pickup.lng,
          dropoffLat: dropoff.lat, dropoffLng: dropoff.lng,
          delivery,
          returnTo: "/rider",
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("Payment setup failed: " + (data.error || "unknown reason"));
    } catch (e) {
      setError("Couldn't set up payment. Try again.");
    }
    setBusy(false);
  };
  const firstName = String(rider.name || "").split(/[ .@]/)[0];
  return (
    <main className="relative w-full h-screen max-w-md mx-auto overflow-hidden" style={{ background: DARK }}>
      <div className="absolute inset-0"><CityMap pickupPos={pickup} dropoffPos={dropoff} showRoute={!!(pickup && dropoff)} /></div>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-5 pb-8 max-h-[78vh] overflow-y-auto" style={{ background: DARK, boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" }}>
        <div className="w-9 h-1 rounded-full mx-auto mb-4" style={{ background: LINE }} />
        <h1 className="text-xl font-bold mb-3" style={{ color: TEXT }}>Where to{firstName ? `, ${firstName}` : ""}?</h1>
        <div className="space-y-2">
          <PlaceInput icon={Navigation} iconColor={ACCENT} placeholder={locating ? "Finding you…" : "Pickup address"} value={pickup}
            onPick={(p) => { setPickup(p); if (p) setNear(p); }} near={near}
            extra={
              <button type="button" onClick={useMyLocation} className="w-full text-left px-3 py-2.5 flex items-center gap-2">
                <Navigation size={15} color={ACCENT} /><span className="text-sm" style={{ color: ACCENT }}>Use my current location</span>
              </button>
            } />
          <PlaceInput icon={Search} iconColor={AMBER} placeholder="Where are you going?" value={dropoff} onPick={setDropoff} near={near || pickup} />
        </div>
        {error && !trip && <p className="text-sm mt-3" style={{ color: "#FF6B6B" }}>{error}</p>}
        {pickup && dropoff && !trip && !error && <p className="text-sm mt-3" style={{ color: MUTED }}>Working out the price…</p>}
        {!trip && <ReportProblem role="rider" user={rider} />}
        {trip && (
          <>
            <p className="text-xs uppercase tracking-wide mt-4 mb-2" style={{ color: MUTED }}>{trip.miles} mi · about {trip.minutes} min · choose a ride</p>
            <div className="space-y-2">
              {VEHICLE_TYPES.map((v) => {
                const Icon = v.icon;
                const on = vehicle === v.id;
                return (
                  <button type="button" key={v.id} onClick={() => setVehicle(v.id)} aria-pressed={on}
                    className="w-full flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: on ? ACCENT : CARD, border: `1px solid ${on ? ACCENT : LINE}` }}>
                    <Icon size={20} color={on ? DARK : MUTED} />
                    <span className="flex-1 text-left">
                      <span className="block text-sm font-semibold" style={{ color: on ? DARK : TEXT }}>{v.name}</span>
                      <span className="block text-xs" style={{ color: on ? CARD : MUTED }}>{v.note}</span>
                    </span>
                    <span className="text-sm font-semibold" style={{ color: on ? DARK : AMBER }}>${priceFor(v).toFixed(2)}</span>
                  </button>
                );
              })}
            </div>
            {isPackage && <PackageForm form={pkgForm} set={setPkg} />}
            {error && <p className="text-sm mt-3" style={{ color: "#FF6B6B" }}>{error}</p>}
            <button type="button" disabled={busy} onClick={request} className="w-full mt-4 py-4 rounded-xl text-base font-semibold" style={{ background: ACCENT, color: DARK }}>
              {busy ? "Opening payment…" : isPackage ? `Pay & send package · $${priceFor(chosen).toFixed(2)}` : `Pay & request ${chosen.name} · $${priceFor(chosen).toFixed(2)}`}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
// ---------- Following the ride ----------
const STATUS = {
  requested: { title: "Finding your driver…", note: "Hang tight, we're matching you with a driver nearby." },
  accepted: { title: "Your driver is on the way", note: "" },
  arrived_pickup: { title: "Your driver is here", note: "Head out to meet them." },
  in_progress: { title: "On your trip", note: "" },
  completed: { title: "You've arrived", note: "How was your ride?" },
  cancelled: { title: "This ride was cancelled", note: "Your payment has been refunded. You can request again." },
};
const PACKAGE_STATUS = {
  requested: { title: "Finding a driver for your package…", note: "We'll match a driver nearby." },
  accepted: { title: "A driver is on the way to pick it up", note: "" },
  arrived_pickup: { title: "Your driver is at pickup", note: "Hand them the package." },
  in_progress: { title: "Your package is on the way", note: "" },
  completed: { title: "Delivered", note: "Here's where your driver left it." },
  cancelled: { title: "This delivery was cancelled", note: "Your payment has been refunded. You can send it again." },
};
function TrackRide({ ride, onDone }) {
  const [showChat, setShowChat] = useState(false);
  const [rated, setRated] = useState(0);
  const pkg = isPackageRide(ride);
  const [proofUrl, setProofUrl] = useState("");
  useEffect(() => {
    if (pkg && ride.dropoff_photo) deliveryPhotoLink(ride.dropoff_photo).then(setProofUrl).catch(() => {});
  }, [pkg, ride.dropoff_photo]);
  const s = (pkg ? PACKAGE_STATUS : STATUS)[ride.status] || { title: ride.status, note: "" };
  const live = ["accepted", "arrived_pickup", "in_progress"].includes(ride.status);
  return (
    <main className="relative w-full h-screen max-w-md mx-auto overflow-hidden" style={{ background: DARK }}>
      <div className="absolute inset-0">
        <CityMap pickupPos={ride.pickup_location} dropoffPos={ride.dropoff_location} driverPos={ride.driver_location} showRoute />
      </div>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-5 pb-8" style={{ background: DARK, boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" }}>
        <div className="w-9 h-1 rounded-full mx-auto mb-4" style={{ background: LINE }} />
        <p className="text-lg font-semibold" style={{ color: TEXT }}>{s.title}</p>
        {s.note && <p className="text-sm mt-1" style={{ color: MUTED }}>{s.note}</p>}
        <p className="text-sm mt-1" style={{ color: MUTED }}>To {ride.destination || "your destination"} · ${Number(ride.fare || 0).toFixed(2)}</p>
        {pkg && ride.delivery?.recipientName && (
          <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color: MUTED }}><Package size={14} /> For {ride.delivery.recipientName}</p>
        )}
        {proofUrl && (
          <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="block mt-3">
            <img src={proofUrl} alt="Where your package was left" className="w-full max-h-56 object-cover rounded-xl" style={{ border: `1px solid ${LINE}` }} />
          </a>
        )}
        {ride.driver_name && (
          <div className="mt-4 rounded-xl p-3 flex items-center justify-between" style={{ background: CARD, border: `1px solid ${LINE}` }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>{ride.driver_name}</p>
              <p className="text-xs" style={{ color: MUTED }}>{[ride.car_model, ride.plate].filter(Boolean).join(" · ")}</p>
            </div>
            {live && (
              <button onClick={() => setShowChat(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: ACCENT, color: DARK }}>
                <MessageCircle size={15} /> Message
              </button>
            )}
          </div>
        )}
        {ride.status === "requested" && (
          <button onClick={async () => { const r = await authPost("/api/cancel-ride", { rideId: ride.id }); if (r.cancelled) onDone(); else alert(r.error || "Couldn't cancel this ride."); }}
            className="w-full mt-4 py-3 rounded-xl text-sm font-medium" style={{ background: CARD, color: "#FF6B6B", border: `1px solid ${LINE}` }}>
            Cancel request
          </button>
        )}
        {ride.status === "completed" && (
          <div className="mt-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} disabled={!!rated}
                  onClick={async () => { setRated(n); await rateDriver(ride.id, ride.driver_uid, n); }}>
                  <Star size={34} fill={n <= rated ? AMBER : "none"} color={AMBER} />
                </button>
              ))}
            </div>
            {rated > 0 && <p className="text-sm text-center mt-2" style={{ color: ACCENT }}>Thanks for rating your driver!</p>}
          </div>
        )}
        {(ride.status === "completed" || ride.status === "cancelled") && (
          <button onClick={onDone} className="w-full mt-4 py-4 rounded-xl text-base font-semibold" style={{ background: ACCENT, color: DARK }}>
            {ride.status === "cancelled" ? "Request again" : pkg ? "Send another package" : "Book another ride"}
          </button>
        )}
        <ReportProblem role="rider" user={{ name: ride.rider_name }} rideId={ride.id} />
      </div>
      {showChat && (
        <ChatPanel rideId={ride.id} mySender="rider" otherName={ride.driver_name || "Driver"}
          quickReplies={["On my way out", "Running 5 min late", "I'm here"]} onClose={() => setShowChat(false)} />
      )}
    </main>
  );
}
export default function RiderPage() {
  const [rider, setRider] = useState(null);
  const [checking, setChecking] = useState(true);
  const [ride, setRide] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [siteOff, setSiteOff] = useState(false);
  useEffect(() => {
    getSiteSettings().then((s) => setSiteOff(s?.site_enabled === false)).catch(() => {});
  }, []);
  useEffect(() => {
    completeMagicLinkSignInRider().then((r) => { if (r) setRider(r); }).catch(() => {}).finally(() => setChecking(false));
  }, []);
  // Coming back from Stripe: wait for the webhook to confirm the payment and
  // create the ride, then start following it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (params.get("payment") !== "pending" || !token) return;
    window.history.replaceState({}, "", "/rider");
    setPaying(true);
    let attempts = 0;
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      attempts++;
      const booking = await getPendingBooking(token);
      if (booking?.ride_id) {
        setRide({ id: booking.ride_id, status: "requested", fare: booking.fare, destination: booking.ride_data?.destination });
        setPaying(false);
        return;
      }
      if (attempts >= 20) {
        setPayError("Confirming your payment is taking longer than expected. If you were charged, your ride will show up shortly.");
        setPaying(false);
        return;
      }
      setTimeout(poll, 1500);
    };
    poll();
    return () => { stopped = true; };
  }, []);
  useEffect(() => {
    if (!ride?.id) return;
    return subscribeToRide(ride.id, (fresh) => setRide((old) => ({ ...old, ...fresh })));
  }, [ride?.id]);
  if (checking) return <main className="min-h-screen" style={{ background: DARK }} />;
  if (paying) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: DARK }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin mb-4" style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
        <p style={{ color: TEXT }}>Confirming your payment…</p>
      </main>
    );
  }
  if (payError && !ride) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: DARK }}>
        <p className="text-sm mb-4" style={{ color: "#FF6B6B" }}>{payError}</p>
        <button onClick={() => setPayError("")} className="px-5 py-3 rounded-xl text-sm font-semibold" style={{ background: ACCENT, color: DARK }}>OK</button>
      </main>
    );
  }
  // Admin turned the whole app off: no new bookings. A ride already under
  // way can still be followed.
  if (siteOff && !ride) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: DARK }}>
        <h2 className="text-xl font-semibold" style={{ color: TEXT }}>Encompass Rideshare</h2>
        <p className="text-sm mt-2" style={{ color: MUTED }}>We're temporarily unavailable right now. Check back soon.</p>
      </main>
    );
  }
  if (!rider) return <SignIn />;
  if (rider.account_off && !ride) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-8 text-center" style={{ background: DARK }}>
        <p className="text-lg font-semibold mb-2" style={{ color: TEXT }}>Your account is turned off</p>
        <p className="text-sm" style={{ color: MUTED }}>You can't book rides or packages right now. Please contact Encompass.</p>
      </main>
    );
  }
  if (!ride) return <BookRide rider={rider} onBooked={setRide} />;
  return <TrackRide ride={ride} onDone={() => setRide(null)} />;
}
