"use client";
import { useState, useEffect } from "react";
import { Car, User, DollarSign, Search, CheckCircle2, CircleDot, Star, AlertTriangle, X, Megaphone } from "lucide-react";
import { ACCENT, AMBER, BG, CARD, BORDER, MUTED, TEXT } from "../../lib/tokens";
import { supabase } from "../../lib/supabase";
import {
  subscribeToAllRides, subscribeToDrivers, subscribeToRiders,
  scheduleVerificationCall, reviewDriverDocuments, updateDriverProfile, loginAdmin,
  subscribeToActiveAnnouncements, createAnnouncement, deactivateAnnouncements,
  getPendingFlatratePlans, approveFlatratePlan, rejectFlatratePlan, resetPassword,
  getSiteSettings, setSiteEnabled, resetAllDriverEarnings, deleteAllRides,
} from "../../lib/supabase-db";
export const dynamic = "force-dynamic";
const STATUS_META = {
  requested: { label: "Requested", color: MUTED },
  accepted: { label: "Accepted", color: ACCENT },
  arrived_pickup: { label: "At pickup", color: AMBER },
  in_progress: { label: "In progress", color: AMBER },
  completed: { label: "Completed", color: "#4ADE80" },
};

const DOC_STATUS_META = {
  not_submitted: { label: "Not submitted", color: MUTED },
  call_scheduled: { label: "Call scheduled", color: ACCENT },
  pending_review: { label: "Pending review", color: AMBER },
  approved: { label: "Approved", color: "#4ADE80" },
  rejected: { label: "Rejected", color: "#FF6B6B" },
};

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function handleBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function handleInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed || !deferredPrompt) return null;

  async function handleInstall() {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return (
    <button onClick={handleInstall} className="px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0"
      style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}>
      Download App
    </button>
  );
}

function SiteToggleCard() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSiteSettings().then((s) => {
      setEnabled(s.site_enabled);
      setLoading(false);
    });
  }, []);

  const handleToggle = async () => {
    const next = !enabled;
    setBusy(true);
    try {
      await setSiteEnabled(next);
      setEnabled(next);
    } catch (err) {
      alert("Couldn't update site status: " + (err.message || "unknown error"));
    }
    setBusy(false);
  };

  if (loading) return null;

  return (
    <div className="rounded-2xl p-4 mb-6 flex items-center justify-between" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: TEXT }}>Rider & driver site access</p>
        <p className="text-xs mt-0.5" style={{ color: MUTED }}>
          {enabled ? "Live — riders and drivers can sign in and book" : "Turned off — riders and drivers see an unavailable message"}
        </p>
      </div>
      <button onClick={handleToggle} disabled={busy}
        className="w-14 h-8 rounded-full flex items-center px-1 transition flex-shrink-0"
        style={{ background: enabled ? "#4ADE80" : "#3D1F1F", justifyContent: enabled ? "flex-end" : "flex-start" }}>
        <span className="w-6 h-6 rounded-full bg-white block" />
      </button>
    </div>
  );
}

function ResetDataCard() {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const handleReset = async () => {
    if (confirmText !== "DELETE") return;
    setBusy(true);
    try {
      await resetAllDriverEarnings();
      await deleteAllRides();
      setDone("Cleared driver earnings and ride history.");
      setConfirmText("");
    } catch (err) {
      alert("Couldn't clear data: " + (err.message || "unknown error"));
    }
    setBusy(false);
  };

  return (
    <div className="rounded-2xl p-4 mb-6" style={{ background: CARD, border: "1px solid #6B2E2E" }}>
      <p className="text-sm font-semibold" style={{ color: "#FF8A8A" }}>Reset test data</p>
      <p className="text-xs mt-1 mb-3" style={{ color: MUTED }}>
        Clears all driver earnings totals and deletes all ride history. This cannot be undone.
      </p>
      <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
        placeholder='Type "DELETE" to confirm'
        className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
        style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }} />
      <button disabled={busy || confirmText !== "DELETE"} onClick={handleReset}
        className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
        style={{ background: "#3D1F1F", color: "#FF6B6B" }}>
        {busy ? "Clearing…" : "Clear all ride & earnings data"}
      </button>
      {done && <p className="text-xs mt-2" style={{ color: "#4ADE80" }}>{done}</p>}
    </div>
  );
}

function PendingPlansPanel() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getPendingFlatratePlans();
      setPending(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleApprove(planId, price) {
    await approveFlatratePlan(planId, price);
    setPending((p) => p.filter((x) => x.id !== planId));
  }

  async function handleReject(planId) {
    await rejectFlatratePlan(planId);
    setPending((p) => p.filter((x) => x.id !== planId));
  }

  if (loading) return null;
  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <h3 className="font-semibold mb-2" style={{ color: TEXT }}>Pending Plan Requests</h3>
      {pending.map((p) => (
        <PlanApprovalRow key={p.id} plan={p} onApprove={handleApprove} onReject={handleReject} />
      ))}
    </div>
  );
}

function PlanApprovalRow({ plan, onApprove, onReject }) {
  const [price, setPrice] = useState(40);
  return (
    <div className="flex items-center gap-2 py-2 border-t text-sm" style={{ borderColor: BORDER }}>
      <div className="flex-1" style={{ color: TEXT }}>
        {plan.riders?.name || "Rider"} — {plan.rides_per_workday}/day, {plan.workdays.join(",")}
      </div>
      <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))}
        className="border rounded p-1 w-16 text-sm" />
      <button onClick={() => onApprove(plan.id, price)} className="px-2 py-1 rounded text-xs text-white" style={{ background: "#4ADE80" }}>Approve</button>
      <button onClick={() => onReject(plan.id)} className="px-2 py-1 rounded text-xs text-white" style={{ background: "#FF6B6B" }}>Reject</button>
    </div>
  );
}

function daysUntil(ts) {
  if (!ts) return null;
  return Math.ceil((ts - Date.now()) / (1000 * 60 * 60 * 24));
}

function tsToDateInput(ts) {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accent ? `${accent}22` : "#23262E" }}>
        <Icon size={18} color={accent || TEXT} />
      </div>
      <div>
        <p className="text-xl font-semibold leading-tight" style={{ color: TEXT }}>{value}</p>
        <p className="text-xs" style={{ color: MUTED }}>{label}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status, color: MUTED };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: `${meta.color}1A`, color: meta.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

function InsuranceExpiryBanner({ drivers }) {
  const flagged = drivers
    .map((d) => ({ ...d, daysLeft: daysUntil(d.insuranceExpiresAt) }))
    .filter((d) => d.daysLeft !== null && d.daysLeft <= 5)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  if (flagged.length === 0) return null;

  return (
    <div className="rounded-2xl p-4 mb-6 flex items-start gap-3" style={{ background: "#3D1F1F", border: "1px solid #6B2E2E" }}>
      <AlertTriangle size={18} color="#FF8A8A" className="flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: "#FFD5D5" }}>
          {flagged.length} driver{flagged.length > 1 ? "s" : ""} need an insurance reminder
        </p>
        <div className="mt-2 space-y-1">
          {flagged.map((d) => (
            <p key={d.uid} className="text-xs" style={{ color: "#F0B8B8" }}>
              <span className="font-medium">{d.name}</span>
              {" — "}
              {d.daysLeft < 0
                ? `expired ${Math.abs(d.daysLeft)} day${Math.abs(d.daysLeft) !== 1 ? "s" : ""} ago`
                : d.daysLeft === 0
                ? "expires today"
                : `expires in ${d.daysLeft} day${d.daysLeft !== 1 ? "s" : ""}`}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function DriverDetailPanel({ driver, onClose }) {
  const [callDate, setCallDate] = useState("");
  const [callTime, setCallTime] = useState("");
  const [zoomLink, setZoomLink] = useState(driver.verificationZoomLink || "");
  const [insuranceDate, setInsuranceDate] = useState(tsToDateInput(driver.insuranceExpiresAt));
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const docStatus = DOC_STATUS_META[driver.documentsStatus] || DOC_STATUS_META.not_submitted;

  const handleScheduleCall = async () => {
    if (!callDate || !callTime || !zoomLink.trim()) return;
    setBusy(true);
    const scheduledAt = new Date(`${callDate}T${callTime}`).getTime();
    await scheduleVerificationCall(driver.uid, { scheduledAt, zoomLink: zoomLink.trim() });
    setBusy(false);
  };

  const handleApprove = async () => {
    setBusy(true);
    await reviewDriverDocuments(driver.uid, true);
    setBusy(false);
  };

  const handleReject = async () => {
    setBusy(true);
    await reviewDriverDocuments(driver.uid, false, rejectReason.trim());
    setRejectReason("");
    setBusy(false);
  };

  const handleSaveInsuranceDate = async () => {
    if (!insuranceDate) return;
    setBusy(true);
    await updateDriverProfile(driver.uid, { insuranceExpiresAt: new Date(insuranceDate).getTime() });
    setBusy(false);
  };

  const handleBackgroundCheckToggle = async (status) => {
    setBusy(true);
    await updateDriverProfile(driver.uid, { backgroundCheckStatus: status });
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-md h-full overflow-y-auto p-6" style={{ background: BG }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: TEXT }}>{driver.name}</h2>
            <p className="text-xs" style={{ color: MUTED }}>{driver.email}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: CARD }}>
            <X size={16} color={TEXT} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <span className="text-xs" style={{ color: MUTED }}>Vehicle</span>
            <span className="text-sm" style={{ color: TEXT }}>{driver.carModel} · {driver.plate}</span>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: MUTED }}>Background check</p>
            <div className="flex gap-2">
              {["pending", "cleared", "failed"].map((s) => (
                <button key={s} disabled={busy} onClick={() => handleBackgroundCheckToggle(s)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium capitalize"
                  style={{
                    background: driver.backgroundCheckStatus === s ? ACCENT : CARD,
                    color: driver.backgroundCheckStatus === s ? "#111318" : TEXT,
                    border: `1px solid ${BORDER}`,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: MUTED }}>Documents & vehicle verification</p>
            <div className="rounded-xl p-3 mb-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <StatusPill status={driver.documentsStatus || "not_submitted"} />
            </div>

            {driver.documentsStatus === "rejected" && driver.documentsRejectionReason && (
              <p className="text-xs mb-3" style={{ color: "#FF6B6B" }}>Last rejection reason: {driver.documentsRejectionReason}</p>
            )}

            <p className="text-xs mb-2" style={{ color: MUTED }}>Schedule verification call</p>
            <div className="flex gap-2 mb-2">
              <input type="date" value={callDate} onChange={(e) => setCallDate(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
              <input type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
            </div>
            <input value={zoomLink} onChange={(e) => setZoomLink(e.target.value)} placeholder="Zoom link"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
            <button disabled={busy} onClick={handleScheduleCall}
              className="w-full py-2.5 rounded-lg text-sm font-medium mb-4" style={{ background: ACCENT, color: "#111318" }}>
              Schedule call
            </button>

            <div className="flex gap-2 mb-2">
              <button disabled={busy} onClick={handleApprove}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#1D3A2A", color: "#4ADE80", border: "1px solid #2A5138" }}>
                Approve
              </button>
              <button disabled={busy} onClick={handleReject}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#3D1F1F", color: "#FF6B6B", border: "1px solid #6B2E2E" }}>
                Reject
              </button>
            </div>
            <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (if rejecting)"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
          </div>

          <div>
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: MUTED }}>Insurance expiration</p>
            <div className="flex gap-2">
              <input type="date" value={insuranceDate} onChange={(e) => setInsuranceDate(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
              <button disabled={busy} onClick={handleSaveInsuranceDate}
                className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: ACCENT, color: "#111318" }}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = subscribeToActiveAnnouncements(setAnnouncements);
    return unsub;
  }, []);

  const handlePost = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await createAnnouncement({ text: text.trim(), createdBy: "admin" });
    setText("");
    setBusy(false);
  };

  const handleRemove = async (id) => {
    await deactivateAnnouncements(id);
  };

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT }}>
        <Megaphone size={15} color={ACCENT} /> Special messages
      </h2>
      <div className="rounded-2xl p-3 mb-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Message for families (e.g. upcoming event, reminder)…"
          rows={3}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none mb-2"
          style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }} />
        <button disabled={busy || !text.trim()} onClick={handlePost}
          className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-40"
          style={{ background: ACCENT, color: "#111318" }}>
          {busy ? "Posting…" : "Post message"}
        </button>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        {announcements.length === 0 ? (
          <div className="p-4 text-center text-xs" style={{ color: MUTED, background: CARD }}>No active messages.</div>
        ) : (
          announcements.map((a, i) => (
            <div key={a.id} className="p-3 flex items-start gap-3" style={{ background: CARD, borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
              <div className="flex-1 min-w-0">
                <p className="text-xs" style={{ color: TEXT }}>{a.text}</p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>{timeAgo(a.createdAt)}</p>
              </div>
              <button onClick={() => handleRemove(a.id)}
                className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
                style={{ background: "#3D1F1F", color: "#FF6B6B" }}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PasswordRecoveryScreen({ onDone }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setSuccess(true);
    } catch (err) {
      setError(err.message?.replace("Firebase: ", "") || "Couldn't update password.");
    }
    setBusy(false);
  };

  if (success) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center px-8" style={{ background: BG }}>
        <div className="w-full max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold" style={{ color: TEXT }}>Password updated</h1>
          <p className="text-sm" style={{ color: MUTED }}>You can now log in with your new password.</p>
          <button onClick={onDone} className="w-full py-3 rounded-xl font-medium text-sm mt-2" style={{ background: ACCENT, color: "#111318" }}>
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center px-8" style={{ background: BG }}>
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold mb-1" style={{ color: TEXT }}>Set a new password</h1>
        <p className="text-sm mb-3" style={{ color: MUTED }}>Choose a new password for your admin account.</p>
        <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" type="password"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
        <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" type="password"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
        {error && <p className="text-sm" style={{ color: "#FF6B6B" }}>{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-3 rounded-xl font-medium text-sm" style={{ background: ACCENT, color: "#111318" }}>
          {busy ? "One sec…" : "Update password"}
        </button>
      </form>
    </div>
  );
}

function AdminAuthScreen({ onAuthed }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const admin = await loginAdmin({ email: email.trim().toLowerCase(), password });
      onAuthed(admin);
    } catch (err) {
      setError(err.message?.replace("Firebase: ", "") || "Login failed.");
    }
    setBusy(false);
  };

  const submitReset = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your email first."); return; }
    setBusy(true);
    try {
      await resetPassword(email.trim().toLowerCase(), "/admin");
      setResetSent(true);
    } catch (err) {
      setError(err.message?.replace("Firebase: ", "") || "Couldn't send the reset email.");
    }
    setBusy(false);
  };

  if (showForgot) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center px-8" style={{ background: BG }}>
        <form onSubmit={submitReset} className="w-full max-w-sm space-y-3">
          <h1 className="text-xl font-semibold mb-1" style={{ color: TEXT }}>Reset password</h1>
          <p className="text-sm mb-3" style={{ color: MUTED }}>Enter your admin email and we'll send a reset link.</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
          {resetSent && <p className="text-sm" style={{ color: "#4ADE80" }}>Check your email for a reset link.</p>}
          {error && <p className="text-sm" style={{ color: "#FF6B6B" }}>{error}</p>}
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl font-medium text-sm" style={{ background: ACCENT, color: "#111318" }}>
            {busy ? "One sec…" : "Send reset link"}
          </button>
          <button type="button" onClick={() => { setShowForgot(false); setError(""); setResetSent(false); }}
            className="w-full text-sm text-center font-medium py-2" style={{ color: ACCENT }}>
            Back to log in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center px-8" style={{ background: BG }}>
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <h1 className="text-xl font-semibold mb-4" style={{ color: TEXT }}>Corporate Login</h1>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
        {error && <p className="text-sm" style={{ color: "#FF6B6B" }}>{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-3 rounded-xl font-medium text-sm" style={{ background: ACCENT, color: "#111318" }}>
          {busy ? "One sec…" : "Log in"}
        </button>
        <button type="button" onClick={() => { setShowForgot(true); setError(""); }}
          className="w-full text-sm text-center font-medium py-1" style={{ color: ACCENT }}>
          Forgot password?
        </button>
      </form>
    </div>
  );
}

function AdminDashboard() {
  const [rides, setRides] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => {
    const unsub1 = subscribeToAllRides(setRides);
    const unsub2 = subscribeToDrivers(setDrivers);
    const unsub3 = subscribeToRiders(setRiders);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  useEffect(() => {
    if (!selectedDriver) return;
    const fresh = drivers.find((d) => d.uid === selectedDriver.uid);
    if (fresh) setSelectedDriver(fresh);
  }, [drivers]);

  const filteredRides = rides.filter((r) => {
    const matchesStatus = filter === "all" || r.status === filter;
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || r.riderName?.toLowerCase().includes(q) || r.driverName?.toLowerCase().includes(q) || r.destination?.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const completed = rides.filter((r) => r.status === "completed");
  const active = rides.filter((r) => r.status !== "completed");
  const totalVolume = completed.reduce((sum, r) => sum + (r.fare || 0), 0);

  return (
    <div className="w-full min-h-screen" style={{ background: BG }}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: TEXT }}>Rides admin</h1>
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>Live — updates instantly, no refresh needed</p>
          </div>
          <InstallAppButton />
        </div>

        <SiteToggleCard />

        <ResetDataCard />

        <InsuranceExpiryBanner drivers={drivers} />

        <PendingPlansPanel />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={Car} label="Total rides" value={rides.length} />
          <StatCard icon={CircleDot} label="Active now" value={active.length} accent={AMBER} />
          <StatCard icon={CheckCircle2} label="Completed" value={completed.length} accent="#4ADE80" />
          <StatCard icon={DollarSign} label="Total volume" value={`$${totalVolume.toFixed(2)}`} accent={ACCENT} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <Search size={15} color={MUTED} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rider, driver, destination…"
                  className="bg-transparent outline-none text-sm w-full" style={{ color: TEXT }} />
              </div>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}>
                <option value="all">All statuses</option>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              {filteredRides.length === 0 ? (
                <div className="p-8 text-center text-sm" style={{ color: MUTED, background: CARD }}>No rides match yet.</div>
              ) : (
                filteredRides.map((r, i) => (
                  <div key={r.id} className="p-4 flex items-center gap-4" style={{ background: CARD, borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate" style={{ color: TEXT }}>{r.riderName}</span>
                        <span style={{ color: MUTED }}>→</span>
                        <span className="text-sm truncate" style={{ color: MUTED }}>{r.destination}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs flex items-center gap-1" style={{ color: MUTED }}><Car size={11} /> {r.driverName || "Unassigned"}</span>
                        <span className="text-xs" style={{ color: MUTED }}>{timeAgo(r.createdAt)}</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium" style={{ color: TEXT }}>${(r.fare || 0).toFixed(2)}</span>
                    <StatusPill status={r.status} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <AnnouncementsPanel />

            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT }}><Car size={15} color={ACCENT} /> Drivers ({drivers.length})</h2>
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                {drivers.length === 0 ? (
                  <div className="p-4 text-center text-xs" style={{ color: MUTED, background: CARD }}>No drivers registered yet.</div>
                ) : (
                  drivers.map((d, i) => (
                    <button key={d.uid} onClick={() => setSelectedDriver(d)}
                      className="w-full p-3 flex items-center gap-3 text-left" style={{ background: CARD, borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#23262E" }}><User size={14} color={TEXT} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: TEXT }}>{d.name}</p>
                        <p className="text-xs truncate" style={{ color: MUTED }}>{d.carModel}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-medium" style={{ color: AMBER }}>${(d.earningsToday || 0).toFixed(0)}</p>
                        <p className="text-xs flex items-center gap-0.5 justify-end" style={{ color: MUTED }}><Star size={9} fill={AMBER} color={AMBER} /> {(d.rating || 5).toFixed(1)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT }}><User size={15} color={ACCENT} /> Riders ({riders.length})</h2>
              <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                {riders.length === 0 ? (
                  <div className="p-4 text-center text-xs" style={{ color: MUTED, background: CARD }}>No riders registered yet.</div>
                ) : (
                  riders.map((u, i) => (
                    <div key={u.uid} className="p-3 flex items-center gap-3" style={{ background: CARD, borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#23262E" }}><User size={14} color={TEXT} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: TEXT }}>{u.name}</p>
                        <p className="text-xs truncate" style={{ color: MUTED }}>{u.email}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedDriver && <DriverDetailPanel driver={selectedDriver} onClose={() => setSelectedDriver(null)} />}
    </div>
  );
}

export default function AdminPage() {
  const [admin, setAdmin] = useState(null);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  if (isRecovery) return <PasswordRecoveryScreen onDone={() => setIsRecovery(false)} />;
  if (!admin) return <AdminAuthScreen onAuthed={setAdmin} />;
  return <AdminDashboard />;
}
