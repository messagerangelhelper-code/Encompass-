"use client";
import { useEffect, useState } from "react";
import { authPost } from "../lib/authPost";

const callPayouts = (body) => authPost("/api/create-account-link", body);

export default function PayoutSetupBanner({ driverProfile }) {
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(
    !!(driverProfile?.payout_setup_complete || driverProfile?.payoutSetupComplete)
  );
  const [error, setError] = useState("");

  // Back from Stripe: check whether setup finished.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("payout");
    if (!flag) return;
    window.history.replaceState({}, "", "/driver");
    callPayouts({ checkOnly: true })
      .then((d) => { if (d.complete) setComplete(true); })
      .catch(() => {});
  }, []);

  const startOnboarding = async () => {
    setLoading(true); setError("");
    try {
      const data = await callPayouts({});
      if (data.complete) { setComplete(true); setLoading(false); return; }
      if (data.url) { window.location.href = data.url; return; }
      setError(data.error || "Couldn't start payout setup.");
    } catch (err) {
      setError("Couldn't start payout setup. Try again.");
    }
    setLoading(false);
  };

  if (!driverProfile || complete) return null;

  return (
    <div className="mb-4 rounded-xl p-3" style={{ background: "#2A2414", border: "1px solid #F5B54A" }}>
      <p className="text-sm" style={{ color: "#F5F5F0" }}>Finish setting up payouts to start getting paid for rides.</p>
      {error && <p className="text-xs mt-1" style={{ color: "#FF6B6B" }}>{error}</p>}
      <button onClick={startOnboarding} disabled={loading}
        className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#F5B54A", color: "#111318" }}>
        {loading ? "Opening…" : "Set up payouts"}
      </button>
    </div>
  );
}
