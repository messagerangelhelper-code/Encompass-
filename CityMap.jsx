"use client";
import { useEffect, useRef, useState } from "react";
import { ACCENT, AMBER } from "../lib/tokens";

let maplibreLoadingPromise = null;
function loadMapLibreGL() {
  if (window.maplibregl) return Promise.resolve();
  if (maplibreLoadingPromise) return maplibreLoadingPromise;
  maplibreLoadingPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return maplibreLoadingPromise;
}

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEFAULT_ZOOM = 3.2;
const MAP_STYLE = "https://demotiles.maplibre.org/style.json";

export default function CityMap({ driverPos, pickupPos, dropoffPos, markerColor = AMBER, showRoute = false }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarker = useRef(null);
  const pickupMarker = useRef(null);
  const dropoffMarker = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadMapLibreGL()
      .then(() => setReady(true))
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;

    const startCenter = driverPos || pickupPos || dropoffPos || DEFAULT_CENTER;

    mapInstance.current = new window.maplibregl.Map({
      container: mapRef.current,
      style: MAP_STYLE,
      center: [startCenter.lng, startCenter.lat],
      zoom: driverPos || pickupPos || dropoffPos ? 14 : DEFAULT_ZOOM,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;

    const points = [];

    if (driverPos) {
      points.push(driverPos);
      if (!driverMarker.current) {
        driverMarker.current = new window.maplibregl.Marker({ color: markerColor })
          .setLngLat([driverPos.lng, driverPos.lat])
          .addTo(map);
      } else {
        driverMarker.current.setLngLat([driverPos.lng, driverPos.lat]);
      }
    } else if (driverMarker.current) {
      driverMarker.current.remove();
      driverMarker.current = null;
    }

    if (pickupPos) {
      points.push(pickupPos);
      if (!pickupMarker.current) {
        pickupMarker.current = new window.maplibregl.Marker({ color: ACCENT })
          .setLngLat([pickupPos.lng, pickupPos.lat])
          .addTo(map);
      } else {
        pickupMarker.current.setLngLat([pickupPos.lng, pickupPos.lat]);
      }
    } else if (pickupMarker.current) {
      pickupMarker.current.remove();
      pickupMarker.current = null;
    }

    if (dropoffPos) {
      points.push(dropoffPos);
      if (!dropoffMarker.current) {
        dropoffMarker.current = new wind
