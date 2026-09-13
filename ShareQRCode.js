"use client";
import { useEffect, useRef } from "react";
import { ACCENT } from "../lib/tokens";

let qrLoadingPromise = null;
function loadQRLibrary() {
  if (window.QRCode) return Promise.resolve();
  if (qrLoadingPromise) return qrLoadingPromise;
  qrLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return qrLoadingPromise;
}

export default function ShareQRCode({ url, label }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    loadQRLibrary().then(() => {
      if (canvasRef.current && window.QRCode) {
        window.QRCode.toCanvas(canvasRef.current, url, { width: 128, margin: 1 });
      }
    });
  }, [url]);

  return (
    <div className="mx-6 mb-6 rounded-2xl p-5 flex flex-col items-center text-center"
      style={{ background: "#181B22", border: "1px solid #2B2F3A" }}>
      <div className="p-3 rounded-xl bg-white">
        <canvas ref={canvasRef} />
      </div>
      <p className="text-sm font-medium mt-3" style={{ color: "#F5F5F0" }}>{label}</p>
      <p className="text-xs mt-1" style={{ color: "#7A7F8A" }}>Scan to share with family & friends</p>
    </div>
  );
}
