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
        dropoffMarker.current = new window.maplibregl.Marker({ color: "#7A7F8A" })
          .setLngLat([dropoffPos.lng, dropoffPos.lat])
          .addTo(map);
      } else {
        dropoffMarker.current.setLngLat([dropoffPos.lng, dropoffPos.lat]);
      }
    } else if (dropoffMarker.current) {
      dropoffMarker.current.remove();
      dropoffMarker.current = null;
    }

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

    if (points.length === 1) {
      map.panTo([points[0].lng, points[0].lat]);
    } else if (points.length > 1) {
      const bounds = points.reduce(
        (b, p) => b.extend([p.lng, p.lat]),
        new window.maplibregl.LngLatBounds([points[0].lng, points[0].lat], [points[0].lng, points[0].lat])
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
