"use client";
import { useState } from "react";

export default function PayoutSetupBanner({ driverProfile }) {
  const [loading, setLoading] = useState(false);

  const startOnboarding = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/create-account-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: driverProfile.stripe_account_id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("No onboarding URL returned:", data.error?.message);
        setLoading(false);
      }
    } catch (err) {
      console.error("Failed to start payout setup:", err.message);
      setLoading(false);
    }
  };

  if (!driverProfile.stripe_account_id) return null; // handled separately below

  return (
    <div className="rounded-md p-3 mb-4 text-sm flex items-center justify-between" style={{ background: "#241f14", border: "1px solid #4a3d1f", color: "#e0cf9d" }}>
      <span>Finish setting up payouts to start getting paid for rides.</span>
      <button
        onClick={startOnboarding}
        disabled={loading}
        className="px-3 py-1.5 rounded-md text-xs font-semibold"
        style={{ background: "#C6A15B", color: "#0B1F3A" }}
      >
        {loading ? "Loading…" : "Complete setup"}
      </button>
    </div>
  );
}
