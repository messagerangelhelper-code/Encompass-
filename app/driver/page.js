"use client";
import { useState, useEffect, useRef } from "react";
import CityMap from "../CityMap";
import ChatPanel from "../ChatPanel";
import PayoutSetupBanner from "../PayoutSetupBanner";
import { ACCENT } from "../../lib/tokens";
import {
  loginDriver, signUpDriver, subscribeToNextPendingRide, subscribeToRide,
  updateRide, updateDriverLocation, setDriverOnlineStatus, rateRider,
} from "../../lib/supabase-db";

export default function DriverPage() {
  const [driver, setDriver] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [carModel, setCarModel] = useState("");
  const [plate, setPlate] = useState("");
  const [authError, setAuthError] = useState("");

  const [online, setOnline] = useState(false);
  const [pendingRide, setPendingRide] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!driver || !online || activeRide) return;
    const unsub = subscribeToNextPendingRide("standard", setPendingRide);
    return unsub;
  }, [driver, online, activeRide]);

  useEffect(() => {
    if (!activeRide?.id) return;
    const unsub = subscribeToRide(activeRide.id, setActiveRide);
    return unsub;
  }, [activeRide?.id]);

  useEffect(() => {
    if (!activeRide || activeRide.status === "completed") {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => updateDriverLocation(activeRide.id, pos.coords.latitude, pos.coords.longitude),
      (err) => console.error("Location error:", err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => { if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [activeRide?.id, activeRide?.status]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (authMode === "login") {
        const d = await loginDriver({ email, password });
        setDriver(d);
      } else {
        const d = await signUpDriver({ name, email, password, carModel, plate, vehicleType: "standard" });
        setDriver(d);
      }
    } catch (err) {
      setAuthError(err.message || "Something went wrong.");
    }
  };

  const toggleOnline = async () => {
    const next = !online;
    setOnline(next);
    await setDriverOnlineStatus(driver.uid, next);
  };

  const acceptRide = async () => {
    await updateRide(pendingRide.id, { status: "accepted", driverUid: driver.uid, driverName: driver.name });
    setActiveRide({ ...pendingRide, status: "accepted", driver_uid: driver.uid, driver_name: driver.name });
    setPendingRide(null);
  };

  const startTrip = () => updateRide(activeRide.id, { status: "in_progress" });
  const completeTrip = async () => {
    await updateRide(activeRide.id, { status: "completed" });
  };
  const finishAndReset = () => setActiveRide(null);
if (!driver) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "#111318" }}>
        <form onSubmit={handleAuth} className="w-full max-w-sm space-y-3">
          <h1 className="text-xl font-bold mb-4" style={{ color: "#F5F5F0" }}>
            {authMode === "login" ? "Driver Login" : "Driver Sign Up"}
          </h1>
          {authMode === "signup" && (
            <>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
                className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
              <input value={carModel} onChange={(e) => setCarModel(e.target.value)} placeholder="Car model"
                className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
              <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="License plate"
                className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
            </>
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email"
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password"
            className="w-full px-4 py-3 rounded-xl text-sm" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          {authError && <p className="text-xs" style={{ color: "#ff6b6b" }}>{authError}</p>}
          <button type="submit" className="w-full py-3 rounded-xl text-sm font-semibold" style={{ background: ACCENT, color: "#111318" }}>
            {authMode === "login" ? "Log In" : "Sign Up"}
          </button>
          <button type="button" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
            className="w-full text-xs" style={{ color: "#7A7F8A" }}>
            {authMode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
          </button>
        </form>
      </main>
    );
  }

  if (driver.pending_approval) {
    return (
      <main className="min-h-screen p-6 space-y-4" style={{ background: "#111318" }}>
        <h1 className="text-lg font-bold" style={{ color: "#F5F5F0" }}>Welcome, {driver.name}</h1>
        <p className="text-sm" style={{ color: "#7A7F8A" }}>
          Your account is pending approval. Document status: {driver.documents_status}
        </p>
        <PayoutSetupBanner driverProfile={driver} />
      </main>
    );
  }

  if (!activeRide) {
    return (
      <main className="min-h-screen p-6 space-y-4" style={{ background: "#111318" }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold" style={{ color: "#F5F5F0" }}>Hi, {driver.name}</h1>
          <button onClick={toggleOnline}
            className="px-4 py-2 rounded-full text-xs font-semibold"
            style={{ background: online ? ACCENT : "#1D2028", color: online ? "#111318" : "#7A7F8A", border: "1px solid #2B2F3A" }}>
            {online ? "Online" : "Offline"}
          </button>
        </div>

        <PayoutSetupBanner driverProfile={driver} />

        {!online && <p className="text-xs" style={{ color: "#7A7F8A" }}>Go online to start receiving ride requests.</p>}
        {online && !pendingRide && <p className="text-xs" style={{ color: "#7A7F8A" }}>Waiting for a ride request…</p>}

        {pendingRide && (
          <div className="p-4 rounded-xl" style={{ background: "#1D2028", border: `1px solid ${ACCENT}` }}>
            <p className="text-sm font-semibold" style={{ color: "#F5F5F0" }}>New ride request</p>
            <p className="text-xs mt-1" style={{ color: "#7A7F8A" }}>To: {pendingRide.destination}</p>
            <p className="text-xs" style={{ color: "#7A7F8A" }}>Fare: ${Number(pendingRide.fare).toFixed(2)}</p>
            <button onClick={acceptRide} className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold" style={{ background: ACCENT, color: "#111318" }}>
              Accept
            </button>
          </div>
        )}
      </main>
    );
  }
const pickupPos = activeRide.pickup_location;
  const dropoffPos = activeRide.dropoff_location;

  return (
    <main className="relative w-full h-screen" style={{ background: "#111318" }}>
      <CityMap pickupPos={pickupPos} dropoffPos={dropoffPos} showRoute markerColor={ACCENT} />
      <div className="absolute top-6 left-4 right-4 p-4 rounded-xl" style={{ background: "#1D2028", border: "1px solid #2B2F3A" }}>
        <p className="text-sm font-semibold" style={{ color: "#F5F5F0" }}>{activeRide.rider_name}</p>
        <p className="text-xs mt-1" style={{ color: "#7A7F8A" }}>To: {activeRide.destination}</p>
        <p className="text-xs" style={{ color: "#7A7F8A" }}>Fare: ${Number(activeRide.fare).toFixed(2)}</p>

        <div className="flex gap-2 mt-3">
          <button onClick={() => setShowChat(true)} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: "#111318", color: ACCENT, border: `1px solid ${ACCENT}` }}>
            Chat
          </button>
          {activeRide.status === "accepted" && (
            <button onClick={startTrip} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: ACCENT, color: "#111318" }}>
              Start Trip
            </button>
          )}
          {activeRide.status === "in_progress" && (
            <button onClick={completeTrip} className="flex-1 py-2 rounded-xl text-xs font-semibold" style={{ background: ACCENT, color: "#111318" }}>
              Complete Trip
            </button>
          )}
        </div>

        {activeRide.status === "completed" && (
          <div className="mt-3">
            <p className="text-xs mb-2" style={{ color: "#7A7F8A" }}>Rate rider:</p>
            <div className="flex gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => rateRider(activeRide.id, activeRide.rider_uid, n)} className="text-lg">⭐</button>
              ))}
            </div>
            <button onClick={finishAndReset} className="w-full py-2 rounded-xl text-xs font-semibold" style={{ background: ACCENT, color: "#111318" }}>
              Done — back online
            </button>
          </div>
        )}
      </div>

      {showChat && (
        <ChatPanel rideId={activeRide.id} mySender="driver" otherName={activeRide.rider_name}
          quickReplies={["On my way", "I've arrived", "Running late"]} onClose={() => setShowChat(false)} />
      )}
    </main>
  );
          }
