"use client";
// "Report a problem" button + sheet for the rider and driver apps.
// Reports go to the Encompass admin, who gets a red light and a beep.
import { useState, useEffect } from "react";
import { AlertTriangle, X, CheckCircle2 } from "lucide-react";
import { PROBLEM_CATEGORIES, sendProblemReport, myProblemReports } from "../lib/problemReports";

const DARK = "#111318", CARD = "#1D2028", LINE = "#2B2F3A", TEXT = "#F5F5F0", MUTED = "#7A7F8A", RED = "#FF6B6B";

function when(ts) {
  try {
    return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

// variant: "button" (full-width) or "link" (small text). light: true on light backgrounds.
export default function ReportProblem({ role = "rider", user, rideId, variant = "link", light = false }) {
  const [open, setOpen] = useState(false);
  const cats = PROBLEM_CATEGORIES[role] || PROBLEM_CATEGORIES.rider;
  const [category, setCategory] = useState(cats[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState([]);

  useEffect(() => {
    if (!open) return;
    myProblemReports().then(setMine).catch(() => {});
  }, [open, sent]);

  const close = () => { setOpen(false); setSent(false); setError(""); };

  const send = async () => {
    setBusy(true); setError("");
    try {
      await sendProblemReport({ role, user, rideId, category, message });
      setSent(true); setMessage("");
    } catch (e) {
      setError(e.message || "Couldn't send your report.");
    }
    setBusy(false);
  };

  const trigger = variant === "button" ? (
    <button type="button" onClick={() => setOpen(true)}
      className="w-full py-3.5 rounded-xl font-medium text-base flex items-center justify-center gap-2"
      style={{ background: CARD, color: RED, border: `1px solid ${LINE}` }}>
      <AlertTriangle size={16} /> Report a problem
    </button>
  ) : (
    <button type="button" onClick={() => setOpen(true)}
      className="w-full mt-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5"
      style={{ color: light ? "#B42318" : RED }}>
      <AlertTriangle size={13} /> Report a problem{rideId ? " with this trip" : ""}
    </button>
  );

  return (
    <>
      {trigger}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={close}>
          <div className="w-full max-w-md rounded-t-3xl p-5 pb-8 max-h-[88vh] overflow-y-auto" style={{ background: DARK }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: TEXT }}>
                <AlertTriangle size={18} color={RED} /> Report a problem
              </h2>
              <button type="button" onClick={close} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: CARD }}>
                <X size={16} color={TEXT} />
              </button>
            </div>

            <p className="text-xs mb-3 p-3 rounded-xl" style={{ background: "#3D1F1F", color: "#FFB4B4" }}>
              In danger right now? Call 911 first.
            </p>

            {sent ? (
              <div className="rounded-xl p-4 text-center mb-4" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                <CheckCircle2 size={28} color="#4ADE80" className="mx-auto mb-2" />
                <p className="text-sm font-semibold" style={{ color: TEXT }}>Report sent</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>Encompass has been alerted. You'll see our answer here.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                <p className="text-xs uppercase tracking-wide" style={{ color: MUTED }}>What kind of problem?</p>
                <div className="flex flex-wrap gap-2">
                  {cats.map((c) => {
                    const on = c === category;
                    return (
                      <button type="button" key={c} onClick={() => setCategory(c)} aria-pressed={on}
                        className="px-3 py-2 rounded-full text-xs font-medium"
                        style={{ background: on ? RED : CARD, color: on ? DARK : TEXT, border: `1px solid ${on ? RED : LINE}` }}>
                        {c}
                      </button>
                    );
                  })}
                </div>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={4}
                  placeholder="What happened?"
                  className="w-full px-3 py-3 rounded-xl text-base outline-none"
                  style={{ background: CARD, color: TEXT, border: `1px solid ${LINE}` }} />
                {rideId && <p className="text-xs" style={{ color: MUTED }}>This trip will be attached to your report.</p>}
                {error && <p className="text-sm" style={{ color: RED }}>{error}</p>}
                <button type="button" disabled={busy || !message.trim()} onClick={send}
                  className="w-full py-3.5 rounded-xl text-base font-semibold disabled:opacity-40"
                  style={{ background: RED, color: DARK }}>
                  {busy ? "Sending…" : "Send report"}
                </button>
              </div>
            )}

            {mine.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide mb-2" style={{ color: MUTED }}>Your reports</p>
                <div className="space-y-2">
                  {mine.map((r) => (
                    <div key={r.id} className="rounded-xl p-3" style={{ background: CARD, border: `1px solid ${LINE}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold" style={{ color: TEXT }}>{r.category}</span>
                        <span className="text-[11px] font-medium" style={{ color: r.status === "resolved" ? "#4ADE80" : "#F5A623" }}>
                          {r.status === "resolved" ? "Resolved" : r.seen_at ? "Being looked at" : "Sent"}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: MUTED }}>{when(r.created_at)} · {r.message}</p>
                      {r.admin_reply && (
                        <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: DARK, color: TEXT }}>Encompass: {r.admin_reply}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
