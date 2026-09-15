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
    setActiveRide({ ...pendingRide,
