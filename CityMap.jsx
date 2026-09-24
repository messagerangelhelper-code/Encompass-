"use client";
import { useEffect, useRef, useState } from "react";
import { ACCENT, AMBER } from "../lib/tokens";

// Loads Mapbox GL JS from the CDN (same pattern as app/family/LiveTrackingMap.js)
// so both components share the same loading approach without adding an npm
// dependency.
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

// Fallback center (roughly the middle of the continental US) used only
// before any real position is known yet.
const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEFAULT_ZOOM = 3.2;

/**
 * Real GPS map. All position props are { lat, lng } (or null/undefined if
 * not yet known) — NOT the old 0-100 simulated grid coordinates.
 *
 * Props:
 *  - driverPos:  live driver location, or null
 *  - pickupPos:  rider's pickup location, or null
 *  - dropoffPos: destination location, or null
 *  - markerColor: color for the driver marker (defaults to AMBER)
 *  - showRoute:  if true and at least two of the three positions are known,
 *                draws a straight line between them (not real road routing)
 */
export default function CityMap({ driverPos, pickupPos, dropoffPos, markerColor = AMBER, showRoute = false }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const driverMarker = useRef(null);
  const pickupMarker = useRef(null);
  const dropoffMarker = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadMapboxGL()
      .then(() => setReady(true))
      .catch(() => setLoadError(true));
  }, []);

  // Create the map once Mapbox GL is loaded.
  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;

    const startCenter = driverPos || pickupPos || dropoffPos || DEFAULT_CENTER;
    window.mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    mapInstance.current = new window.mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [startCenter.lng, startCenter.lat],
      zoom: driverPos || pickupPos || dropoffPos ? 14 : DEFAULT_ZOOM,
    });
    // No on-screen zoom control — it overlapped the app's own top-right
    // buttons (earnings, safety, profile). Pinch-to-zoom still works fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Keep markers, the route line, and the camera in sync with live props.
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    const map = mapInstance.current;

    const points = [];

    if (driverPos) {
      points.push(driverPos);
      if (!driverMarker.current) {
        driverMarker.current = new window.mapboxgl.Marker({ color: markerColor })
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
        pickupMarker.current = new window.mapboxgl.Marker({ color: ACCENT })
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
        dropoffMarker.current = new window.mapboxgl.Marker({ color: "#7A7F8A" })
          .setLngLat([dropoffPos.lng, dropoffPos.lat])
          .addTo(map);
      } else {
        dropoffMarker.current.setLngLat([dropoffPos.lng, dropoffPos.lat]);
      }
    } else if (dropoffMarker.current) {
      dropoffMarker.current.remove();
      dropoffMarker.current = null;
    }

    // Route line (straight line between points — not real road routing).
    const routeGeoJSON = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: points.map((p) => [p.lng, p.lat]),
      },
    };
    const drawLine = () => {
      if (!map.getSource("route-line")) {
        map.addSource("route-line", { type: "geojson", data: routeGeoJSON });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route-line",
          paint: { "line-color": ACCENT, "line-width": 2.5, "line-dasharray": [1, 1.5] },
        });
      } else {
        map.getSource("route-line").setData(routeGeoJSON);
      }
    };
    if (showRoute && points.length >= 2) {
      if (map.isStyleLoaded()) drawLine();
      else map.once("load", drawLine);
    } else if (map.getLayer && map.getLayer("route-line")) {
      map.removeLayer("route-line");
      map.removeSource("route-line");
    }

    // Frame the camera around whatever points we currently have.
    if (points.length === 1) {
      map.panTo([points[0].lng, points[0].lat]);
    } else if (points.length > 1) {
      const bounds = points.reduce(
        (b, p) => b.extend([p.lng, p.lat]),
        new window.mapboxgl.LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 600 });
    }
  }, [ready, driverPos?.lat, driverPos?.lng, pickupPos?.lat, pickupPos?.lng, dropoffPos?.lat, dropoffPos?.lng, showRoute, markerColor]);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "#1D2028" }}>
        <p className="text-xs" style={{ color: "#7A7F8A" }}>Map failed to load.</p>
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full" />;
}
