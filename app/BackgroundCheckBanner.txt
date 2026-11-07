"use client";
import { useEffect, useState } from "react";
import { authPost } from "../lib/authPost";
import { BACKGROUND_CHECK_FEE_CENTS, dollars } from "../lib/backgroundCheck";

const callFee = (action) => authPost("/api/background-fee", { action });

// Shows the driver where their background check stands, and lets them pick
// how to pay the fee: now by card, or out of their first ride payouts.
// Calls onStatus(status) whenever it learns the latest status.
export default function BackgroundCheckBanner({ driverProfile, onStatus }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const apply = (s) => {
    if (s && s.checkStatus) { setStatus(s); onStatus?.(s); }
    else if (s?.error) setError(s.error);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const backFromStripe = params.get("bgfee");
    if (backFromStripe) window.history.replaceState({}, "", "/driver");
    let tries = 0;
    let timer = null;
    const load = () => callFee("status").then((s) => {
      apply(s);
      // Stripe tells us about the payment a moment after the driver comes back.
      if (backFromStripe && s?.feeStatus !== "paid" && ++tries < 6) timer = setTimeout(load, 2000);
    }).catch(() => {});
    load();
    return () => clearTimeout(timer);
  }, []);

  const payNow = async () => {
    setLoading(true); setError("");
    try {
      const data = await callFee("pay_now");
      if (data.url) { window.location.href = data.url; return; }
      apply(data);
    } catch (err) {
      setError("Couldn't open the payment page. Try again.");
    }
    setLoading(false);
  };

  const fromPayouts = async () => {
    setLoading(true); setError("");
    try { apply(await callFee("from_payouts")); }
    catch (err) { setError("Couldn't save your choice. Try again."); }
    setLoading(false);
  };

  if (!driverProfile || !status || status.checkStatus === "cleared") return null;

  const box = (border, bg, children) => (
    <div className="mb-4 rounded-xl p-3" style={{ background: bg, border: `1px solid ${border}` }}>{children}</div>
  );
  const text = (t, color = "#F5F5F0") => <p className="text-sm" style={{ color }}>{t}</p>;
  const err = error && <p className="text-xs mt-1" style={{ color: "#FF6B6B" }}>{error}</p>;

  if (status.checkStatus === "failed") {
    return box("#6B2E2E", "#3D1F1F", text("Your background check didn't pass, so you can't drive with Encompass. Contact support if you think this is a mistake.", "#FF6B6B"));
  }

  if (status.feeStatus === "unpaid") {
    return box("#F5B54A", "#2A2414", (
      <>
        {text(`Texas law requires a background check before you drive. The check costs ${dollars(BACKGROUND_CHECK_FEE_CENTS)}. How do you want to pay?`)}
        {err}
        <div className="mt-2 flex gap-2">
          <button onClick={payNow} disabled={loading}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "#F5B54A", color: "#111318" }}>
            {loading ? "One sec…" : "Pay now"}
          </button>
          <button onClick={fromPayouts} disabled={loading}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }}>
            From my ride pay
          </button>
        </div>
      </>
    ));
  }

  return box("#2B2F3A", "#1D2028", (
    <>
      {text("Watch your email for a background check invite from Checkr and fill it out. You can go online once your check clears.")}
      {status.feeStatus === "owed" && (
        <>
          <p className="text-xs mt-1" style={{ color: "#9A9890" }}>
            {dollars(status.owedCents)} will come out of your ride pay.
          </p>
          <button onClick={payNow} disabled={loading} className="text-xs mt-1 underline" style={{ color: "#F5B54A" }}>
            {loading ? "One sec…" : "Pay it now instead"}
          </button>
        </>
      )}
      {err}
    </>
  ));
}
