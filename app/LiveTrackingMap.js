
"use client";
import { useEffect, useRef, useState } from "react";
import { subscribeToFamilyActiveRide } from "../../lib/supabase-db";
let mapboxLoadingPromise = null;
function loadMapboxGL() {
  if (window.mapboxgl) return Promise.resolve();
  if (mapboxLoadingPromise) return mapboxLoadingPromise;
  mapboxLoadingPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return mapboxLoadingPromise;
}

export default function LiveTrackingMap({ memberUids }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerInstance = useRef(null);
  const [activeRide, setActiveRide] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = subscribeToFamilyActiveRide(memberUids, setActiveRide);
    return unsub;
  }, [memberUids]);

  useEffect(() => {
    loadMapboxGL().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !activeRide?.driverLocation || !mapRef.current) return;
    const { lat, lng } = activeRide.driverLocation;
    window.mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!mapInstance.current) {
      mapInstance.current = new window.mapboxgl.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [lng, lat],
        zoom: 15,
      });
      markerInstance.current = new window.mapboxgl.Marker({ color: "#6C5CE7" })
        .setLngLat([lng, lat])
        .addTo(mapInstance.current);
    } else {
      markerInstance.current.setLngLat([lng, lat]);
      mapInstance.current.panTo([lng, lat]);
    }
  }, [ready, activeRide?.driverLocation]);

  if (!activeRide) {
    return (
      <div className="mx-6 mb-4 rounded-xl p-3 text-center" style={{ color: "#7A7F8A", border: "1px dashed #2B2F3A" }}>
        <p className="text-xs">No family member is currently on a ride.</p>
      </div>
    );
  }
  if (!activeRide.driverLocation) {
    return (
      <div className="mx-6 mb-4 rounded-xl p-3 text-center" style={{ color: "#7A7F8A", border: "1px dashed #2B2F3A" }}>
        <p className="text-xs">Waiting for the driver's location…</p>
      </div>
    );
  }
  return (
    <div className="mx-6 mb-4 rounded-xl overflow-hidden" style={{ border: "1px solid #2B2F3A", height: "220px" }}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
