"use client";
import { useState, useEffect, useRef } from "react";
import { Car, User, DollarSign, Search, CheckCircle2, CircleDot, Star, AlertTriangle, X, Megaphone, Package, Camera } from "lucide-react";
import { ACCENT, AMBER, BG, CARD, BORDER, MUTED, TEXT } from "../../lib/tokens";
import { supabase } from "../../lib/supabase";
import {
  subscribeToAllRides, subscribeToDrivers, subscribeToRiders,
  scheduleVerificationCall, reviewDriverDocuments, updateDriverProfile, loginAdmin,
  subscribeToActiveAnnouncements, createAnnouncement, deactivateAnnouncements,
  getPendingFlatratePlans, approveFlatratePlan, rejectFlatratePlan, resetPassword,
  getSiteSettings, setSiteEnabled, resetAllDriverEarnings, deleteAllRides,
  proofLinks, reviewHaulBadge,
} from "../../lib/supabase-db";
import { isHauler, badgeId, restrictedStates, driverGvwr } from "../../lib/haulRules";
import { isPackageRide, deliveryPhotoLink } from "../../lib/delivery";
import { subscribeToProblemReports, markProblemSeen, answerProblemReport, reopenProblemReport } from "../../lib/problemReports";
import { ridesForYear, companyTotals, driverYearRows, riderYearRows, dollars, downloadCsv } from "../../lib/adminReports";
export const dynamic = "force-dynamic";
const STATUS_META = {
  requested: { label: "Requested", color: MUTED },
  accepted: { label: "Accepted", color: ACCENT },
  arrived_pickup: { label: "At pickup", color: AMBER },
  in_progress: { label: "In progress", color: AMBER },
  completed: { label: "Completed", color: "#4ADE80" },
  cancelled: { label: "Cancelled", color: "#FF6B6B" },
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

// Pickup and drop-off photos for a package delivery (private, links last 1 hour)
function PackagePhotos({ ride }) {
  const [links, setLinks] = useState(null);
  const pickup = ride.pickup_photo || ride.pickupPhoto;
  const dropoff = ride.dropoff_photo || ride.dropoffPhoto;
  useEffect(() => {
    let live = true;
    Promise.all([deliveryPhotoLink(pickup), deliveryPhotoLink(dropoff)])
      .then(([a, b]) => { if (live) setLinks({ pickup: a, dropoff: b }); })
      .catch(() => { if (live) setLinks({ pickup: "", dropoff: "" }); });
    return () => { live = false; };
  }, [pickup, dropoff]);
  const d = ride.delivery || {};
  const shot = (url, label) => (
    <div className="flex-1 min-w-0">
      <p className="text-xs mb-1" style={{ color: MUTED }}>{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={label} className="w-full h-36 object-cover rounded-lg" style={{ border: `1px solid ${BORDER}` }} />
        </a>
      ) : (
        <div className="w-full h-36 rounded-lg flex items-center justify-center text-xs text-center px-2" style={{ background: BG, color: MUTED, border: `1px solid ${BORDER}` }}>
          {links ? "No photo yet" : "Loading…"}
        </div>
      )}
    </div>
  );
  return (
    <div className="mt-3 space-y-2">
      {(d.contents || d.recipientName) && (
        <p className="text-xs" style={{ color: MUTED }}>
          {d.size ? `${d.size[0].toUpperCase()}${d.size.slice(1)} · ` : ""}{d.contents || ""}{d.recipientName ? ` · for ${d.recipientName}` : ""}
        </p>
      )}
      <div className="flex gap-3">
        {shot(links?.pickup, "Pickup photo")}
        {shot(links?.dropoff, "Drop-off photo")}
      </div>
    </div>
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

  const confirmed = confirmText.trim().toUpperCase() === "DELETE";
  const handleReset = async () => {
    if (!confirmed) return;
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
        autoCapitalize="characters" autoCorrect="off" spellCheck={false}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-2"
        style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }} />
      <button disabled={busy || !confirmed} onClick={handleReset}
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

function HaulBadgeBanner({ drivers }) {
  const waiting = drivers.filter((d) => d.haulBadgeStatus === "pending");
  if (!waiting.length) return null;
  return (
    <div className="rounded-2xl p-4 mb-6" style={{ background: "#2A2414", border: "1px solid #5C4A1E" }}>
      <p className="text-sm font-semibold" style={{ color: AMBER }}>
        🛡️ {waiting.length} Certified Hauler badge request{waiting.length > 1 ? "s" : ""} waiting
      </p>
      <p className="text-xs mt-1" style={{ color: MUTED }}>Open the driver below to check their proof: {waiting.map((d) => d.name).join(", ")}</p>
    </div>
  );
}

const PROOF_LABELS = { sticker: "Weight sticker", dot: "USDOT proof", insurance: "Insurance card", cdl: "CDL" };

function HaulBadgeReview({ driver }) {
  const [links, setLinks] = useState({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { proofLinks(driver.haulProof).then(setLinks).catch(() => setLinks({})); }, [JSON.stringify(driver.haulProof || {})]);
  if (!isHauler(driver.vehicleType)) return null;
  const status = driver.haulBadgeStatus || "none";
  const review = async (ok) => {
    if (!ok && !note.trim()) { alert("Write a short reason so the driver knows what to fix."); return; }
    setBusy(true);
    try { await reviewHaulBadge(driver.uid, ok, note.trim()); setNote(""); }
    catch (e) { alert("Couldn't save: " + (e.message || "unknown error")); }
    setBusy(false);
  };
  const gvwr = driverGvwr(driver);
  return (
    <div>
      <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: MUTED }}>Certified Hauler badge</p>
      <div className="rounded-xl p-3 mb-3 space-y-1" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <p className="text-sm" style={{ color: status === "approved" ? "#4ADE80" : status === "pending" ? AMBER : TEXT }}>
          {status === "approved" ? `🛡️ Approved · ${badgeId(driver)}` : status === "pending" ? "Waiting for your review" : status === "rejected" ? "Not approved" : "Not requested"}
        </p>
        <p className="text-xs" style={{ color: MUTED }}>GVWR {gvwr.toLocaleString()} lbs{driver.gvwr ? "" : " (not entered, using the usual for this vehicle)"} · USDOT {driver.dotNumber || "—"}</p>
        {driver.dotNumber && (
          <a href={`https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${driver.dotNumber}`}
            target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: ACCENT }}>Look up this USDOT number on FMCSA SAFER ↗</a>
        )}
        {!!restrictedStates(gvwr).length && status !== "approved" && (
          <p className="text-xs" style={{ color: MUTED }}>Without the badge, blocked in {restrictedStates(gvwr).length} states.</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {Object.keys(links).length ? Object.entries(links).map(([k, url]) => (
            <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-lg" style={{ background: "#23262E", color: TEXT }}>
              📄 {PROOF_LABELS[k] || k}
            </a>
          )) : <span className="text-xs" style={{ color: MUTED }}>No proof uploaded.</span>}
        </div>
      </div>
      {(status === "pending" || status === "approved" || status === "rejected") && (
        <>
          <div className="flex gap-2 mb-2">
            {status !== "approved" && (
              <button disabled={busy} onClick={() => review(true)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#1D3A2A", color: "#4ADE80", border: "1px solid #2A5138" }}>Approve badge</button>
            )}
            <button disabled={busy} onClick={() => review(false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: "#3D1F1F", color: "#FF6B6B", border: "1px solid #6B2E2E" }}>
              {status === "approved" ? "Take badge away" : "Reject"}
            </button>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (if rejecting)"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }} />
        </>
      )}
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
            <div className="rounded-xl p-3 mt-2 space-y-1" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="text-xs" style={{ color: MUTED }}>
                Check fee:{" "}
                <span style={{ color: TEXT }}>
                  {driver.bgFeeStatus === "paid" ? "Paid"
                    : driver.bgFeeStatus === "owed" ? `Owes $${((driver.bgFeeOwedCents || 0) / 100).toFixed(2)}, coming out of ride pay`
                    : "Not chosen yet"}
                </span>
              </p>
              <p className="text-xs" style={{ color: driver.checkrInviteReady && driver.backgroundCheckStatus === "pending" ? AMBER : MUTED }}>
                {driver.checkrInviteReady
                  ? (driver.backgroundCheckStatus === "pending"
                    ? `Ready: send the Checkr invite to ${driver.email || "this driver"}, then mark Cleared when it passes.`
                    : "Checkr invite: done")
                  : "Not ready for a Checkr invite yet (fee choice needed)"}
              </p>
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

          <HaulBadgeReview driver={driver} />

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

const CHECK_META = {
  cleared: { label: "Cleared", color: "#4ADE80" },
  pending: { label: "Check pending", color: AMBER },
  failed: { label: "Check failed", color: "#FF6B6B" },
};

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function Pill({ label, color }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: `${color}1A`, color }}>{label}</span>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT }}><Icon size={15} color={ACCENT} /> {children}</h2>
  );
}

function ReportTable({ headers, rows, empty }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      {rows.length === 0 ? (
        <div className="p-4 text-center text-xs" style={{ color: MUTED, background: CARD }}>{empty}</div>
      ) : (
        <table className="w-full text-xs" style={{ background: CARD }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={h} className={`p-3 font-medium ${i === 0 ? "text-left" : "text-right"}`} style={{ color: MUTED }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} style={{ borderTop: `1px solid ${BORDER}` }}>
                {r.cells.map((c, i) => (
                  <td key={i} className={`p-3 ${i === 0 ? "text-left truncate max-w-[10rem]" : "text-right"}`} style={{ color: TEXT }}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Problem report alerts: red light + beep until opened ----------
function useAlarm(ringing) {
  const ctxRef = useRef(null);
  const [soundOn, setSoundOn] = useState(false);

  const unlock = async () => {
    try {
      if (!ctxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctxRef.current = new AC();
      }
      if (ctxRef.current.state !== "running") await ctxRef.current.resume();
      const on = ctxRef.current.state === "running";
      setSoundOn(on);
      return on;
    } catch { return false; }
  };

  // Browsers only allow sound after a tap, so any tap on the page turns it on.
  useEffect(() => {
    const onTap = () => { unlock(); };
    window.addEventListener("pointerdown", onTap);
    window.addEventListener("keydown", onTap);
    return () => { window.removeEventListener("pointerdown", onTap); window.removeEventListener("keydown", onTap); };
  }, []);

  useEffect(() => {
    if (!ringing || !soundOn) return;
    const beep = () => {
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== "running") return;
      [0, 0.35].forEach((delay) => {
        const t = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.27);
      });
      try { navigator.vibrate?.([200, 150, 200]); } catch {}
    };
    beep();
    const timer = setInterval(beep, 2000);
    return () => clearInterval(timer);
  }, [ringing, soundOn]);

  return { soundOn, unlock };
}

function RedLight({ size = 10, flashing = true }) {
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      {flashing && <span className="absolute inline-flex w-full h-full rounded-full animate-ping" style={{ background: "#FF3B3B", opacity: 0.75 }} />}
      <span className="relative inline-flex rounded-full w-full h-full" style={{ background: "#FF3B3B", boxShadow: "0 0 8px #FF3B3B" }} />
    </span>
  );
}

function AlertBar({ soundOn, unlock, unseen, onShow }) {
  if (soundOn && unseen.length === 0) return null;
  return (
    <div className="space-y-2 mb-6">
      {!soundOn && (
        <button type="button" onClick={unlock}
          className="w-full rounded-2xl p-3 flex items-center justify-center gap-2 text-sm font-semibold"
          style={{ background: "#3A2A12", color: AMBER, border: `1px solid ${AMBER}55` }}>
          🔔 Turn on sound alerts
        </button>
      )}
      {unseen.length > 0 && (
        <button type="button" onClick={onShow}
          className="w-full rounded-2xl p-3 flex items-center gap-3 text-left"
          style={{ background: "#3D1F1F", border: "1px solid #FF3B3B" }}>
          <RedLight size={12} />
          <span className="text-sm font-semibold flex-1" style={{ color: "#FFB4B4" }}>
            {unseen.length} new problem report{unseen.length > 1 ? "s" : ""}. Beeping until you open {unseen.length > 1 ? "them" : "it"}.
          </span>
          <span className="text-xs font-semibold" style={{ color: "#FF6B6B" }}>Show</span>
        </button>
      )}
    </div>
  );
}

function reportTime(ts) {
  try { return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

function ProblemReportCard({ report }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(report.admin_reply || "");
  const [busy, setBusy] = useState(false);
  const unseen = !report.seen_at;
  const resolved = report.status === "resolved";

  const openIt = async () => {
    setOpen((o) => !o);
    if (unseen) { try { await markProblemSeen(report.id); } catch {} }
  };
  const save = async (resolve) => {
    setBusy(true);
    try { await answerProblemReport(report.id, { reply, resolve }); if (resolve) setOpen(false); }
    catch (e) { alert("Couldn't save: " + (e.message || "unknown error")); }
    setBusy(false);
  };

  return (
    <div className="p-3" style={{ background: unseen ? "#2A1A1A" : CARD }}>
      <button type="button" onClick={openIt} className="w-full flex items-start gap-3 text-left">
        <span className="mt-1">
          {resolved ? <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#4ADE80" }} />
            : <RedLight size={10} flashing={unseen} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold truncate" style={{ color: TEXT }}>{report.category}</span>
            <span className="text-[11px] flex-shrink-0" style={{ color: unseen ? "#FF6B6B" : resolved ? "#4ADE80" : AMBER }}>
              {unseen ? "NEW" : resolved ? "Resolved" : "Open"}
            </span>
          </span>
          <span className="block text-xs truncate" style={{ color: MUTED }}>
            {report.reporter_name || report.reporter_email || "Unknown"} · {reportTime(report.created_at)}
          </span>
          {!open && <span className="block text-xs truncate mt-0.5" style={{ color: TEXT }}>{report.message}</span>}
        </span>
      </button>
      {open && (
        <div className="mt-3 ml-6 space-y-2">
          <p className="text-sm whitespace-pre-wrap" style={{ color: TEXT }}>{report.message}</p>
          <p className="text-xs" style={{ color: MUTED }}>
            {report.reporter_email || ""}{report.ride_id ? ` · Trip ${String(report.ride_id).slice(0, 8)}` : ""}
          </p>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={1000}
            placeholder="Your answer (they'll see it in the app)"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }} />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => save(false)}
              className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }}>
              Save answer
            </button>
            {resolved ? (
              <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await reopenProblemReport(report.id); } catch {} setBusy(false); }}
                className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ background: "#3A2A12", color: AMBER }}>
                Reopen
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => save(true)}
                className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ background: "#1D3A2A", color: "#4ADE80", border: "1px solid #2A5138" }}>
                Answer & resolve
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProblemReportsPanel({ role, reports }) {
  const [showResolved, setShowResolved] = useState(false);
  const mine = reports.filter((r) => r.reporter_role === role);
  const open = mine.filter((r) => r.status !== "resolved")
    .sort((a, b) => (a.seen_at ? 1 : 0) - (b.seen_at ? 1 : 0));
  const resolved = mine.filter((r) => r.status === "resolved");
  const list = showResolved ? [...open, ...resolved] : open;
  const anyUnseen = open.some((r) => !r.seen_at);
  return (
    <div id={`problem-reports-${role}`} className="scroll-mt-24">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT }}>
        {open.length > 0 ? <RedLight size={10} flashing={anyUnseen} /> : <AlertTriangle size={15} color={ACCENT} />}
        {role === "driver" ? "Driver" : "Rider"} problem reports ({open.length} open)
      </h2>
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${open.length ? "#FF3B3B66" : BORDER}` }}>
        {list.length === 0 ? (
          <div className="p-4 text-center text-xs" style={{ color: MUTED, background: CARD }}>No open reports.</div>
        ) : (
          list.map((r, i) => (
            <div key={r.id} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
              <ProblemReportCard report={r} />
            </div>
          ))
        )}
      </div>
      {resolved.length > 0 && (
        <button type="button" onClick={() => setShowResolved((s) => !s)} className="text-xs mt-2 font-medium" style={{ color: ACCENT }}>
          {showResolved ? "Hide resolved" : `Show ${resolved.length} resolved`}
        </button>
      )}
    </div>
  );
}

// ---------- Year-end tax report ----------
function TaxReport({ role, drivers, riders }) {
  const thisYear = new Date().getFullYear();
  const years = [];
  for (let y = thisYear; y >= 2025; y--) years.push(y);
  const [year, setYear] = useState(thisYear);
  const [rides, setRides] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true); setError("");
    try { setRides(await ridesForYear(year)); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  useEffect(() => { setRides(null); }, [year]);

  const totals = rides ? companyTotals(rides) : null;
  const driverRows = rides && role === "driver" ? driverYearRows(rides, drivers) : [];
  const riderRows = rides && role === "rider" ? riderYearRows(rides, riders) : [];

  const exportCsv = () => {
    if (role === "driver") {
      downloadCsv(`encompass-driver-pay-${year}.csv`,
        ["Driver", "Email", "Completed trips", "Packages", "Fares collected", "Encompass fees", "Driver share", "Check fees taken", "Paid out", "Not paid yet", "Share $2,000 or more"],
        driverRows.map((r) => [r.name, r.email, r.trips, r.packages, dollars(r.gross), dollars(r.fee), dollars(r.share), dollars(r.checkFee), dollars(r.paid), dollars(r.unpaid), r.over2000 ? "Yes" : "No"]));
    } else {
      downloadCsv(`encompass-rider-spending-${year}.csv`,
        ["Rider", "Email", "Booked", "Completed", "Packages", "Spent", "Refunded rides", "Refunded amount"],
        riderRows.map((r) => [r.name, r.email, r.booked, r.completed, r.packages, dollars(r.spent), r.refunded, dollars(r.refunds)]));
    }
  };

  return (
    <div>
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: TEXT }}>
        <DollarSign size={15} color={ACCENT} /> {role === "driver" ? "Year-end driver pay (for 1099s)" : "Year-end rider spending"}
      </h2>
      <div className="rounded-2xl p-4 space-y-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex gap-2">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={load}
            className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: ACCENT, color: "#111318" }}>
            {busy ? "Loading…" : rides ? "Refresh" : `Load ${year}`}
          </button>
          {rides && (
            <button type="button" onClick={exportCsv}
              className="px-3 py-2 rounded-xl text-sm font-medium" style={{ background: BG, color: TEXT, border: `1px solid ${BORDER}` }}>
              Download CSV
            </button>
          )}
        </div>
        {error && <p className="text-xs" style={{ color: "#FF6B6B" }}>{error}</p>}

        {totals && (
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Completed trips", totals.trips],
              ["Fares collected", `$${totals.gross}`],
              ["Encompass fees", `$${totals.fees}`],
              ["Driver share", `$${totals.driverShare}`],
              ["Check fees taken", `$${totals.checkFees}`],
              ["Refunds", `$${totals.refunds}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl p-2.5" style={{ background: BG }}>
                <p className="text-[11px]" style={{ color: MUTED }}>{k}</p>
                <p className="text-sm font-semibold" style={{ color: TEXT }}>{v}</p>
              </div>
            ))}
          </div>
        )}

        {rides && role === "driver" && (
          <ReportTable headers={["Driver", "Trips", "Share", "Paid out", "Not paid"]}
            rows={driverRows.map((r) => ({ key: r.uid, cells: [`${r.name || r.email || "Driver"}${r.over2000 ? " ⚑" : ""}`, r.trips, `$${dollars(r.share)}`, `$${dollars(r.paid)}`, `$${dollars(r.unpaid)}`] }))}
            empty="No drivers yet." />
        )}
        {rides && role === "rider" && (
          <ReportTable headers={["Rider", "Completed", "Spent", "Refunds"]}
            rows={riderRows.map((r) => ({ key: r.uid, cells: [r.name || r.email || "Rider", r.completed, `$${dollars(r.spent)}`, `$${dollars(r.refunds)}`] }))}
            empty="No riders yet." />
        )}

        <p className="text-[11px]" style={{ color: MUTED }}>
          {role === "driver"
            ? "⚑ = driver share of $2,000 or more this year, so a 1099-NEC is likely needed. Driver share is fare minus the $2.75 Encompass fee. These are app records; Stripe's are the official ones."
            : "Spent counts completed rides only. These are app records; Stripe's are the official ones."}
        </p>
      </div>
    </div>
  );
}

// Switch between the Driver dashboard and the Rider dashboard
function DashboardSwitch({ view, setView, counts, alerts = {} }) {
  const tab = (id, label, Icon) => {
    const on = view === id;
    return (
      <button type="button" onClick={() => setView(id)} aria-pressed={on}
        className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition"
        style={{ background: on ? ACCENT : "transparent", color: on ? "#111318" : TEXT }}>
        <Icon size={16} /> {label} ({counts[id]})
        {alerts[id]?.open > 0 && <RedLight size={10} flashing={alerts[id].unseen > 0} />}
      </button>
    );
  };
  return (
    <div className="flex gap-1 p-1 rounded-2xl mb-6 sticky top-2 z-10" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      {tab("drivers", "Drivers", Car)}
      {tab("riders", "Riders", User)}
    </div>
  );
}

// ---------- Driver dashboard ----------
function DriverDashboard({ drivers, riders, rides, reports, onOpenDriver }) {
  const completed = rides.filter((r) => r.status === "completed");
  const online = drivers.filter((d) => d.isOnline);
  const cleared = drivers.filter((d) => d.backgroundCheckStatus === "cleared");
  const needsYou = drivers.filter((d) =>
    (d.backgroundCheckStatus || "pending") === "pending" ||
    d.documentsStatus === "pending_review" ||
    d.haulBadgeStatus === "pending");
  const payoutReady = drivers.filter((d) => d.payoutSetupComplete);
  const feesOwed = drivers.reduce((s, d) => s + (d.bgFeeStatus === "owed" ? (d.bgFeeOwedCents || 0) : 0), 0) / 100;
  const earningsToday = drivers.reduce((s, d) => s + Number(d.earningsToday || 0), 0);
  const delivered = completed.filter((r) => isPackageRide(r));

  const tripRows = drivers.map((d) => {
    const mine = completed.filter((r) => r.driverUid === d.uid);
    const pkgs = mine.filter((r) => isPackageRide(r)).length;
    const unpaid = mine.filter((r) => !r.driverPaid).length;
    return {
      key: d.uid,
      sort: mine.length,
      cells: [d.name || d.email || "Driver", mine.length, pkgs, money(mine.reduce((s, r) => s + Number(r.fare || 0), 0)), unpaid],
    };
  }).sort((a, b) => b.sort - a.sort);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Car} label="Drivers" value={drivers.length} />
        <StatCard icon={CircleDot} label="Online now" value={online.length} accent="#4ADE80" />
        <StatCard icon={CheckCircle2} label="Checks cleared" value={cleared.length} accent={ACCENT} />
        <StatCard icon={AlertTriangle} label="Waiting on you" value={needsYou.length} accent={AMBER} />
        <StatCard icon={DollarSign} label="Earnings today" value={money(earningsToday)} accent={AMBER} />
        <StatCard icon={DollarSign} label="Payout setup done" value={`${payoutReady.length} of ${drivers.length}`} accent={ACCENT} />
        <StatCard icon={DollarSign} label="Check fees owed" value={money(feesOwed)} accent="#FF6B6B" />
        <StatCard icon={Package} label="Packages delivered" value={delivered.length} accent={ACCENT} />
      </div>

      <ProblemReportsPanel role="driver" reports={reports} />

      <InsuranceExpiryBanner drivers={drivers} />
      <HaulBadgeBanner drivers={drivers} />

      <div>
        <SectionTitle icon={Car}>All drivers ({drivers.length})</SectionTitle>
        <p className="text-xs mb-2" style={{ color: MUTED }}>Tap a driver to clear their background check, review documents or badges.</p>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          {drivers.length === 0 ? (
            <div className="p-4 text-center text-xs" style={{ color: MUTED, background: CARD }}>No drivers registered yet.</div>
          ) : (
            drivers.map((d, i) => {
              const check = CHECK_META[d.backgroundCheckStatus || "pending"] || CHECK_META.pending;
              const docs = DOC_STATUS_META[d.documentsStatus] || DOC_STATUS_META.not_submitted;
              return (
                <button key={d.uid} onClick={() => onOpenDriver(d)}
                  className="w-full p-3 flex items-center gap-3 text-left" style={{ background: CARD, borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                  <div className="relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#23262E" }}>
                    <User size={15} color={TEXT} />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full" style={{ background: d.isOnline ? "#4ADE80" : "#555B66", border: `2px solid ${CARD}` }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: TEXT }}>{d.name}</p>
                    <p className="text-xs truncate" style={{ color: MUTED }}>{d.carModel}{d.plate ? ` · ${d.plate}` : ""}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Pill label={check.label} color={check.color} />
                      <Pill label={`Docs: ${docs.label}`} color={docs.color} />
                      {!d.payoutSetupComplete && <Pill label="Payout not set up" color={AMBER} />}
                      {d.bgFeeStatus === "owed" && <Pill label={`Owes ${money((d.bgFeeOwedCents || 0) / 100)}`} color="#FF6B6B" />}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium" style={{ color: AMBER }}>{money(d.earningsToday)}</p>
                    <p className="text-xs flex items-center gap-0.5 justify-end" style={{ color: MUTED }}><Star size={9} fill={AMBER} color={AMBER} /> {Number(d.rating || 5).toFixed(1)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div>
        <SectionTitle icon={CheckCircle2}>Trips by driver</SectionTitle>
        <ReportTable headers={["Driver", "Trips", "Packages", "Fares", "Not paid yet"]} rows={tripRows} empty="No drivers yet." />
      </div>

      <TaxReport role="driver" drivers={drivers} riders={riders} />
    </div>
  );
}

// ---------- Rider dashboard ----------
function RiderDashboard({ rides, riders, drivers, reports }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [openRide, setOpenRide] = useState(null);

  const completed = rides.filter((r) => r.status === "completed");
  const active = rides.filter((r) => r.status !== "completed" && r.status !== "cancelled");
  const cancelled = rides.filter((r) => r.status === "cancelled");
  const packages = rides.filter((r) => isPackageRide(r));
  const totalVolume = completed.reduce((sum, r) => sum + Number(r.fare || 0), 0);
  const refunded = rides.filter((r) => r.refunded);

  const filteredRides = rides.filter((r) => {
    const matchesStatus = filter === "all" || (filter === "packages" ? isPackageRide(r) : r.status === filter);
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || r.riderName?.toLowerCase().includes(q) || r.driverName?.toLowerCase().includes(q) || r.destination?.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const riderRows = riders.map((u) => {
    const mine = rides.filter((r) => r.riderUid === u.uid);
    const done = mine.filter((r) => r.status === "completed");
    return {
      key: u.uid,
      sort: mine.length,
      cells: [u.name || u.email || "Rider", mine.length, done.length, mine.filter((r) => isPackageRide(r)).length, money(done.reduce((s, r) => s + Number(r.fare || 0), 0))],
    };
  }).sort((a, b) => b.sort - a.sort);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={User} label="Riders" value={riders.length} />
        <StatCard icon={Car} label="Total rides" value={rides.length} />
        <StatCard icon={CircleDot} label="Active now" value={active.length} accent={AMBER} />
        <StatCard icon={CheckCircle2} label="Completed" value={completed.length} accent="#4ADE80" />
        <StatCard icon={DollarSign} label="Total volume" value={money(totalVolume)} accent={ACCENT} />
        <StatCard icon={Package} label="Packages sent" value={packages.length} accent={ACCENT} />
        <StatCard icon={X} label="Cancelled" value={cancelled.length} accent="#FF6B6B" />
        <StatCard icon={DollarSign} label="Refunded" value={refunded.length} accent={MUTED} />
      </div>

      <ProblemReportsPanel role="rider" reports={reports} />

      <PendingPlansPanel />

      <div>
        <SectionTitle icon={Car}>Rides</SectionTitle>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-0" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <Search size={15} color={MUTED} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rider, driver, destination…"
              className="bg-transparent outline-none text-sm w-full" style={{ color: TEXT }} />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}>
            <option value="all">All rides</option>
            <option value="packages">Packages only</option>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>{meta.label}</option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
          {filteredRides.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: MUTED, background: CARD }}>No rides match yet.</div>
          ) : (
            filteredRides.map((r, i) => {
              const pkg = isPackageRide(r);
              return (
                <div key={r.id} className="p-4" style={{ background: CARD, borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {pkg && <Package size={14} color={ACCENT} className="flex-shrink-0" />}
                        <span className="text-sm font-medium truncate" style={{ color: TEXT }}>{r.riderName}</span>
                        <span style={{ color: MUTED }}>→</span>
                        <span className="text-sm truncate" style={{ color: MUTED }}>{r.destination}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs flex items-center gap-1" style={{ color: MUTED }}><Car size={11} /> {r.driverName || "Unassigned"}</span>
                        <span className="text-xs" style={{ color: MUTED }}>{timeAgo(r.createdAt)}</span>
                        {pkg && (
                          <button type="button" onClick={() => setOpenRide(openRide === r.id ? null : r.id)}
                            className="text-xs flex items-center gap-1 font-medium" style={{ color: ACCENT }}>
                            <Camera size={11} /> {openRide === r.id ? "Hide photos" : "Photos"}
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-medium" style={{ color: TEXT }}>{money(r.fare)}</span>
                    <StatusPill status={r.status} />
                  </div>
                  {pkg && openRide === r.id && <PackagePhotos ride={r} />}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div>
        <SectionTitle icon={User}>Rides by rider</SectionTitle>
        <ReportTable headers={["Rider", "Booked", "Completed", "Packages", "Spent"]} rows={riderRows} empty="No riders registered yet." />
      </div>

      <TaxReport role="rider" drivers={drivers} riders={riders} />

      <AnnouncementsPanel />
    </div>
  );
}

function AdminDashboard() {
  const [rides, setRides] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [riders, setRiders] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [view, setViewState] = useState("drivers");
  const [reports, setReports] = useState([]);
  useEffect(() => subscribeToProblemReports(setReports), []);
  const openReports = reports.filter((r) => r.status !== "resolved");
  const unseen = openReports.filter((r) => !r.seen_at);
  const { soundOn, unlock } = useAlarm(unseen.length > 0);
  const alerts = {
    drivers: { open: openReports.filter((r) => r.reporter_role === "driver").length, unseen: unseen.filter((r) => r.reporter_role === "driver").length },
    riders: { open: openReports.filter((r) => r.reporter_role === "rider").length, unseen: unseen.filter((r) => r.reporter_role === "rider").length },
  };
  const showNewest = () => {
    const role = unseen[0]?.reporter_role === "rider" ? "rider" : "driver";
    setView(role === "rider" ? "riders" : "drivers");
    setTimeout(() => document.getElementById(`problem-reports-${role}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  useEffect(() => {
    try { const saved = localStorage.getItem("encompass-admin-view"); if (saved === "riders" || saved === "drivers") setViewState(saved); } catch {}
  }, []);
  const setView = (v) => {
    setViewState(v);
    try { localStorage.setItem("encompass-admin-view", v); } catch {}
  };

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

  return (
    <div className="w-full min-h-screen" style={{ background: BG }}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: TEXT }}>Encompass admin</h1>
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>Live — updates instantly, no refresh needed</p>
          </div>
          <InstallAppButton />
        </div>

        <AlertBar soundOn={soundOn} unlock={unlock} unseen={unseen} onShow={showNewest} />

        <SiteToggleCard />

        <ResetDataCard />

        <DashboardSwitch view={view} setView={setView} counts={{ drivers: drivers.length, riders: riders.length }} alerts={alerts} />

        {view === "drivers"
          ? <DriverDashboard drivers={drivers} riders={riders} rides={rides} reports={reports} onOpenDriver={setSelectedDriver} />
          : <RiderDashboard rides={rides} riders={riders} drivers={drivers} reports={reports} />}
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
