"use client";
export const dynamic = "force-dynamic";
import ShareQRCode from "../../components/ShareQRCode";
import LiveTrackingMap from "./LiveTrackingMap";
import { useState, useEffect } from "react";
import { Users, Heart, Copy, LogOut, Car, DollarSign, AlertTriangle, Megaphone, Radio, Info, Briefcase, Truck, Video } from "lucide-react";
import { ACCENT, AMBER } from "../../lib/tokens";
import {
  signUpFamily, loginFamily, resetPassword,
  sendMagicLinkFamily, completeMagicLinkSignInFamily,
  createFamily, joinFamily, subscribeToFamily, leaveFamily, getFamilyMembers, removeFamilyMember,
  getMemberRideActivity, subscribeToActiveAnnouncements,
  createJobPost, subscribeToOpenJobPosts, claimJobPost,
} from "../../lib/supabase-db";

function FamilyAuthScreen({ onAuthed }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSendMagicLink = async () => {
    setError("");
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
      setError("Enter a valid email address (e.g. name@example.com).");
      return;
    }
    setBusy(true);
    try {
      await sendMagicLinkFamily(email.trim().toLowerCase());
      setLinkSent(true);
    } catch (err) {
      setError(err.message?.replace("Firebase: ", "") || "Couldn't send the sign-in link.");
    }
    setBusy(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const magicResult = await completeMagicLinkSignInFamily();
        if (magicResult) onAuthed(magicResult);
      } catch (err) {
        setError(err.message?.replace("Firebase: ", "") || "Sign-in failed.");
      }
    })();
  }, []);

  return (
    <div className="min-h-full w-full flex flex-col justify-center px-8" style={{ background: "#111318" }}>
      <div className="mb-8">
        <div className="w-11 h-11 rounded-2xl mb-6 flex items-center justify-center" style={{ background: ACCENT }}>
          <Heart size={20} color="#111318" strokeWidth={2.5} />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "#F5F5F0" }}>
          Family Hub
        </h1>
        <p className="mt-1 text-sm font-medium" style={{ color: ACCENT }}>
          Parental Control
        </p>
        <p className="mt-2 text-sm" style={{ color: "#7A7F8A" }}>
          Log in to see rides and jobs across your whole family.
        </p>
      </div>
      <div className="space-y-3">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email"
          autoComplete="email"
          className="w-full px-4 py-3.5 rounded-xl text-base outline-none"
          style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
        {linkSent && (
          <p className="text-xs" style={{ color: ACCENT }}>Check your email for a sign-in link — tap it on this device to continue.</p>
        )}
        {error && <p className="text-sm" style={{ color: "#FF6B6B" }}>{error}</p>}
        <button type="button" onClick={handleSendMagicLink} disabled={busy}
          className="w-full py-3.5 rounded-xl font-medium text-base mt-1 transition active:scale-[0.98]"
          style={{ background: ACCENT, color: "#111318" }}>
          {busy ? "One sec…" : "Encompass Rideshare"}
        </button>
      </div>
      <button type="button" onClick={() => setShowHelp((s) => !s)}
        className="mt-6 text-sm text-center font-medium" style={{ color: ACCENT }}>
        Trouble signing in?
      </button>
      {showHelp && (
        <div className="mt-3 rounded-xl p-3 text-xs leading-relaxed" style={{ background: "#1D2028", color: "#B9BBC2", border: "1px solid #2B2F3A" }}>
          <p className="mb-1.5">• Use the same email every time you sign in — sign-ins aren't shared across different emails.</p>
          <p>• Open the sign-in link on this same device to finish signing in.</p>
        </div>
      )}
    </div>
  );
}

function CreateOrJoinScreen({ person, onFamilyReady }) {
  const [tab, setTab] = useState("create");
  const [codeInput, setCodeInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setBusy(true);
    setError("");
    try {
      const family = await createFamily(person);
      onFamilyReady(family);
    } catch (err) {
      setError(err.message || "Couldn't create a family right now.");
    }
    setBusy(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!codeInput.trim()) { setError("Enter an invite code first."); return; }
    setBusy(true);
    setError("");
    try {
      const family = await joinFamily(person, codeInput);
      onFamilyReady(family);
    } catch (err) {
      setError(err.message || "Couldn't join that family.");
    }
    setBusy(false);
  };

  return (
    <div className="w-full h-full flex flex-col justify-center px-8" style={{ background: "#111318" }}>
      <div className="mb-6 text-center">
        <Users size={28} color={ACCENT} className="mx-auto" />
        <h2 className="text-xl font-semibold mt-3" style={{ color: "#F5F5F0" }}>
          Hi, {person.name.split(" ")[0]}
        </h2>
        <p className="text-sm mt-1" style={{ color: "#7A7F8A" }}>
          Start a family group, or join one with a code.
        </p>
      </div>

      <div className="flex rounded-xl overflow-hidden mb-5" style={{ border: "1px solid #2B2F3A" }}>
        <button onClick={() => { setTab("create"); setError(""); }}
          className="flex-1 py-2.5 text-sm font-medium"
          style={{ background: tab === "create" ? ACCENT : "transparent", color: tab === "create" ? "#111318" : "#7A7F8A" }}>
          Create a family
        </button>
        <button onClick={() => { setTab("join"); setError(""); }}
          className="flex-1 py-2.5 text-sm font-medium"
          style={{ background: tab === "join" ? ACCENT : "transparent", color: tab === "join" ? "#111318" : "#7A7F8A" }}>
          Join with a code
        </button>
      </div>

      {tab === "create" ? (
        <div>
          <p className="text-sm mb-4" style={{ color: "#B9BBC2" }}>
            You'll get a 6-character invite code to share with the rest of your family.
          </p>
          {error && <p className="text-sm mb-3" style={{ color: "#FF6B6B" }}>{error}</p>}
          <button onClick={handleCreate} disabled={busy}
            className="w-full py-3.5 rounded-xl font-medium text-base"
            style={{ background: ACCENT, color: "#111318" }}>
            {busy ? "Creating…" : "Create my family"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleJoin}>
          <input value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="Invite code" maxLength={6}
            className="w-full px-4 py-3.5 rounded-xl text-base outline-none mb-3 tracking-widest text-center font-semibold"
            style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          {error && <p className="text-sm mb-3" style={{ color: "#FF6B6B" }}>{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full py-3.5 rounded-xl font-medium text-base"
            style={{ background: ACCENT, color: "#111318" }}>
            {busy ? "Joining…" : "Join family"}
          </button>
        </form>
      )}
    </div>
  );
}

const FEED_COLORS = ["#6C5CE7", "#FFB020", "#4ADE80", "#FB7185", "#38BDF8", "#F472B6"];

const STATUS_LABEL = {
  requested: "Requested",
  accepted: "Accepted",
  arrived_pickup: "Driver arrived",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

function dayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function ActivityFeed({ members }) {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!members.length) { setFeed([]); setLoading(false); return; }
      setLoading(true);
      const colorByUid = {};
      members.forEach((m, i) => { colorByUid[m.uid] = FEED_COLORS[i % FEED_COLORS.length]; });
      const results = await Promise.all(
        members.map(async (m) => {
          const rides = await getMemberRideActivity(m.uid);
          return rides.map((r) => ({ ...r, memberName: m.name, memberColor: colorByUid[m.uid] }));
        })
      );
      const merged = results.flat().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 40);
      if (!cancelled) { setFeed(merged); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [members]);

  if (loading) {
    return <p className="text-xs text-center py-6" style={{ color: "#7A7F8A" }}>Loading activity…</p>;
  }

  if (!feed.length) {
    return (
      <div className="rounded-xl p-4 text-center text-xs mt-2" style={{ color: "#7A7F8A", border: "1px dashed #2B2F3A" }}>
        No rides yet. Once a family member takes a ride, it'll show up here.
      </div>
    );
  }

  let lastDay = null;
  return (
    <div className="space-y-1">
      {feed.map((item) => {
        const day = dayLabel(item.createdAt);
        const showDay = day !== lastDay;
        lastDay = day;
        const firstName = item.memberName?.split(" ")[0] || "Someone";
        const verb = item.memberRole === "driver" ? "drove to" : "rode to";
        return (
          <div key={item.id}>
            {showDay && (
              <p className="text-xs uppercase tracking-wide mt-3 mb-1" style={{ color: "#7A7F8A" }}>{day}</p>
            )}
            <div className="flex items-start gap-3 rounded-xl p-3"
              style={{ background: "#181B22", border: "1px solid #2B2F3A" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0"
                style={{ background: item.memberColor, color: "#111318" }}>
                {firstName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "#F5F5F0" }}>
                  {firstName} — {verb} {item.destination}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#7A7F8A" }}>
                  {item.vehicleType || "standard"} · {item.miles ?? "—"} mi
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#7A7F8A" }}>
                  {STATUS_LABEL[item.status] || item.status} · {timeLabel(item.createdAt)}
                </p>
              </div>
              {item.fare != null && (
                <p className="text-sm font-semibold flex-shrink-0" style={{ color: AMBER }}>${item.fare.toFixed(2)}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScrollingTicker() {
  const text = "Encompass Rideshare — live AMBER Alerts, local news, and weather coming soon to this space — Encompass Rideshare — ";
  return (
    <div className="mx-6 mb-4 rounded-xl overflow-hidden" style={{ background: "#181B22", border: "1px solid #2B2F3A" }}>
      <div className="py-2 px-3 whitespace-nowrap overflow-hidden relative">
        <div className="inline-block" style={{ animation: "encompass-ticker 18s linear infinite" }}>
          <span className="text-xs font-medium tracking-wide" style={{ color: ACCENT }}>{text}{text}</span>
        </div>
      </div>
      <style>{`
        @keyframes encompass-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function AlertBanners() {
  const [amberAlerts, setAmberAlerts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadAmber() {
      try {
        const res = await fetch("/api/amber-alerts");
        const data = await res.json();
        if (!cancelled) setAmberAlerts(data.alerts || []);
      } catch (e) {
        if (!cancelled) setAmberAlerts([]);
      }
    }
    loadAmber();
    const interval = setInterval(loadAmber, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const unsub = subscribeToActiveAnnouncements(setAnnouncements);
    return unsub;
  }, []);

  if (!amberAlerts.length && !announcements.length) return null;

  return (
    <div className="px-6 pt-2 space-y-2">
      {amberAlerts.map((a) => (
        <div key={a.id} className="rounded-xl p-3 flex items-start gap-2.5"
          style={{ background: "rgba(255,176,32,0.14)", border: `1px solid ${AMBER}` }}>
          <AlertTriangle size={16} color={AMBER} className="flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: AMBER }}>AMBER Alert</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: "#F5F5F0" }}>{a.headline}</p>
            <p className="text-xs mt-1" style={{ color: "#B9BBC2" }}>{a.areaDesc}</p>
          </div>
        </div>
      ))}
      {announcements.map((m) => (
        <div key={m.id} className="rounded-xl p-3 flex items-start gap-2.5"
          style={{ background: "rgba(108,92,231,0.12)", border: `1px solid ${ACCENT}` }}>
          <Megaphone size={16} color={ACCENT} className="flex-shrink-0 mt-0.5" />
          <p className="text-sm" style={{ color: "#F5F5F0" }}>{m.text}</p>
        </div>
      ))}
    </div>
  );
}

function JobBoard({ person }) {
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [price, setPrice] = useState("");
  const [vehicleType, setVehicleType] = useState("truck");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = subscribeToOpenJobPosts(setJobs);
    return () => unsub();
  }, []);

  const submitJob = async (e) => {
    e.preventDefault();
    setError("");
    if (!pickup.trim() || !dropoff.trim() || !price) {
      setError("Fill in pickup, dropoff, and price.");
      return;
    }
    setBusy(true);
    try {
      await createJobPost({
        postedByName: person.name, postedByUid: person.uid,
        pickup: pickup.trim(), dropoff: dropoff.trim(),
        price: parseFloat(price), vehicleType,
      });
      setPickup(""); setDropoff(""); setPrice(""); setShowForm(false);
    } catch (err) {
      setError(err.message || "Couldn't post the job.");
    }
    setBusy(false);
  };

  const claim = async (jobId) => {
    try {
      await claimJobPost(jobId, person.name, person.uid);
    } catch (err) {
      alert(err.message || "Couldn't claim this job.");
    }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: "#181B22", border: "1px solid #2B2F3A" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Briefcase size={16} color={ACCENT} />
          <p className="text-sm font-semibold" style={{ color: "#F5F5F0" }}>Job board</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)}
          className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: ACCENT, color: "#111318" }}>
          {showForm ? "Cancel" : "Post a job"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitJob} className="space-y-2 mb-3">
          <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Pickup location"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: "#111318", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Dropoff location"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: "#111318", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price ($)" type="number" min="0" step="0.01"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: "#111318", color: "#F5F5F0", border: "1px solid #2B2F3A" }} />
          <div className="flex gap-2">
            {["truck", "cargo van"].map((v) => (
              <button key={v} type="button" onClick={() => setVehicleType(v)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium capitalize"
                style={{ background: vehicleType === v ? ACCENT : "#111318", color: vehicleType === v ? "#111318" : "#F5F5F0", border: "1px solid #2B2F3A" }}>
                <Truck size={13} /> {v}
              </button>
            ))}
          </div>
          {error && <p className="text-xs" style={{ color: "#FF6B6B" }}>{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full py-2.5 rounded-lg text-sm font-medium" style={{ background: ACCENT, color: "#111318" }}>
            {busy ? "Posting…" : "Post job"}
          </button>
        </form>
      )}

      {jobs.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "#7A7F8A" }}>No open jobs right now.</p>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-xl p-3" style={{ background: "#111318", border: "1px solid #2B2F3A" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium capitalize flex items-center gap-1" style={{ color: ACCENT }}>
                  <Truck size={12} /> {job.vehicleType}
                </span>
                <span className="text-sm font-semibold" style={{ color: "#F5F5F0" }}>${job.price.toFixed(2)}</span>
              </div>
              <p className="text-xs mb-0.5" style={{ color: "#F5F5F0" }}>{job.pickup} → {job.dropoff}</p>
              <p className="text-xs mb-2" style={{ color: "#7A7F8A" }}>Posted by {job.postedByName}</p>
              <button onClick={() => claim(job.id)}
                className="w-full py-2 rounded-lg text-xs font-medium" style={{ background: ACCENT, color: "#111318" }}>
                Claim job
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveVideoPanel() {
  return (
    <div className="hidden md:flex fixed top-1/2 -translate-y-1/2 w-24 rounded-2xl overflow-hidden z-20 flex-col items-center justify-center text-center p-2"
      style={{ left: "calc(50% + 13rem)", background: "rgba(24,27,34,0.95)", border: "1px solid #2B2F3A", boxShadow: "0 8px 20px -4px rgba(0,0,0,0.5)" }}>
      <Video size={16} color="#7A7F8A" className="mb-1" />
      <p className="text-[10px] font-semibold" style={{ color: "#F5F5F0" }}>Live video</p>
      <p className="text-[9px] leading-tight mt-0.5" style={{ color: "#7A7F8A" }}>Appears during an active Family Ride</p>
    </div>
  );
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
    <button onClick={handleInstall} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium mt-2"
      style={{ background: "#181B22", color: "#F5F5F0", border: "1px solid #2B2F3A" }}>
      Download App
    </button>
  );
}

function FamilyDashboard({ person, family, onLogout }) {
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [liveTrackingOn, setLiveTrackingOn] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (family?.memberUids?.length) getFamilyMembers(family.memberUids).then(setMembers);
  }, [family?.memberUids]);

  const myRole = family.roles?.[person.uid] || "member";
  const isGuardian = myRole === "guardian";

  const copyCode = () => {
    navigator.clipboard?.writeText(family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleLeave = async () => {
    await leaveFamily(person, family.id);
    onLogout();
  };

  const handleRemove = async (targetUid) => {
    await removeFamilyMember(family.id, targetUid);
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#111318" }}>
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-semibold" style={{ color: "#F5F5F0" }}>Family Hub</h1>
        <p className="text-sm font-medium mt-0.5" style={{ color: ACCENT }}>Parental Control</p>
      </div>

      <div className="mx-6 mb-2 rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "#181B22", border: "1px solid #2B2F3A" }}>
        <div className="flex items-center gap-2.5">
          <Radio size={16} color={liveTrackingOn ? "#4ADE80" : "#7A7F8A"} />
          <div>
            <p className="text-sm font-medium" style={{ color: "#F5F5F0" }}>Live tracking</p>
            <p className="text-xs" style={{ color: "#7A7F8A" }}>See a family member's ride in real time</p>
          </div>
        </div>
        <button onClick={() => setLiveTrackingOn((v) => !v)}
          className="w-12 h-7 rounded-full flex items-center px-0.5 transition flex-shrink-0"
          style={{ background: liveTrackingOn ? ACCENT : "#2B2F3A", justifyContent: liveTrackingOn ? "flex-end" : "flex-start" }}>
          <span className="w-6 h-6 rounded-full bg-white block" />
        </button>
      </div>
      {liveTrackingOn && <LiveTrackingMap memberUids={family.memberUids} />}

      <div className="mx-6 mb-2 rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "#181B22", border: "1px solid #2B2F3A" }}>
        <div className="flex items-center gap-2.5">
          <Info size={16} color={showAbout ? ACCENT : "#7A7F8A"} />
          <div>
            <p className="text-sm font-medium" style={{ color: "#F5F5F0" }}>About</p>
            <p className="text-xs" style={{ color: "#7A7F8A" }}>Our mission and how Family Hub works</p>
          </div>
        </div>
        <button onClick={() => setShowAbout((v) => !v)}
          className="w-12 h-7 rounded-full flex items-center px-0.5 transition flex-shrink-0"
          style={{ background: showAbout ? ACCENT : "#2B2F3A", justifyContent: showAbout ? "flex-end" : "flex-start" }}>
          <span className="w-6 h-6 rounded-full bg-white block" />
        </button>
      </div>
      {showAbout && (
        <div className="mx-6 mb-4 rounded-xl p-4 space-y-4" style={{ background: "#181B22", border: "1px solid #2B2F3A" }}>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#F5F5F0" }}>Our mission</p>
            <p className="text-xs leading-relaxed" style={{ color: "#B9BBC2" }}>
              [Add your mission statement here — a sentence or two about why Encompass Rideshare exists and what you're building toward.]
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#F5F5F0" }}>Contact</p>
            <p className="text-xs leading-relaxed" style={{ color: "#B9BBC2" }}>
              [Add a support email or phone number here.]
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold mb-2" style={{ color: "#F5F5F0" }}>How Family Hub works</p>
            <div className="space-y-2.5">
              <div>
                <p className="text-xs font-medium" style={{ color: "#F5F5F0" }}>Inviting family members</p>
                <p className="text-xs leading-relaxed" style={{ color: "#B9BBC2" }}>Guardians can share the invite code above with family members so they can join and be seen on this dashboard.</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: "#F5F5F0" }}>Activity feed</p>
                <p className="text-xs leading-relaxed" style={{ color: "#B9BBC2" }}>Shows each family member's ride history, grouped by day, so guardians can see where rides happened.</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: "#F5F5F0" }}>Alerts</p>
                <p className="text-xs leading-relaxed" style={{ color: "#B9BBC2" }}>Amber alerts pull from the official emergency feed for your area. Special messages are posted by Encompass admin when needed.</p>
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: "#F5F5F0" }}>Live tracking</p>
                <p className="text-xs leading-relaxed" style={{ color: "#B9BBC2" }}>Will show a family member's ride in real time once map integration is turned on.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-6 mb-4">
        <JobBoard person={person} />
      </div>

      <ScrollingTicker />
      <AlertBanners />

      {isGuardian && (
        <div className="mx-6 mb-4 rounded-2xl p-4 flex items-center justify-between"
          style={{ background: "#181B22", border: "1px solid #2B2F3A" }}>
          <div>
            <p className="text-xs" style={{ color: "#7A7F8A" }}>Invite code</p>
            <p className="text-lg font-semibold tracking-widest" style={{ color: "#F5F5F0" }}>{family.inviteCode}</p>
          </div>
          <button onClick={copyCode} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ background: "#111318", color: ACCENT }}>
            <Copy size={13} /> {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      <div className="px-6 flex-1 overflow-y-auto">
        <div className="mb-2">
          <p className="text-xs uppercase tracking-wide" style={{ color: "#7A7F8A" }}>
            {members.length} {members.length === 1 ? "member" : "members"}
          </p>
        </div>
        <div className="space-y-2 mb-5">
          {members.map((m) => {
            const role = family.roles?.[m.uid] || "member";
            return (
              <div key={m.uid} className="flex items-center gap-3 rounded-xl p-3"
                style={{ background: "#181B22", border: "1px solid #2B2F3A" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm"
                  style={{ background: ACCENT, color: "#111318" }}>
                  {m.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: "#F5F5F0" }}>{m.name?.split(" ")[0]}</p>
                  <p className="text-xs" style={{ color: role === "guardian" ? ACCENT : "#7A7F8A" }}>
                    {role === "guardian" ? "Guardian" : "Member"}
                  </p>
                </div>
                {m.uid === person.uid ? (
                  <span className="text-xs" style={{ color: "#7A7F8A" }}>You</span>
                ) : (
                  isGuardian && role !== "guardian" && (
                    <button onClick={() => handleRemove(m.uid)}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                      style={{ background: "#1D2028", color: "#FF6B6B" }}>
                      Remove
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>

        <div className="mb-2 flex items-center gap-2">
          <Car size={13} color="#7A7F8A" />
          <p className="text-xs uppercase tracking-wide" style={{ color: "#7A7F8A" }}>Recent activity</p>
        </div>
        <ActivityFeed members={members} />
      </div>

      <ShareQRCode url="https://encompassrs.com/family" label="Share Family Hub" />

      <div className="px-6 py-5">
        <button onClick={handleLeave}
          className="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2"
          style={{ background: "#1D2028", color: "#FF6B6B", border: "1px solid #2B2F3A" }}>
          <LogOut size={15} /> Leave family
        </button>
        <InstallAppButton />
      </div>
    </div>
  );
}

export default function FamilyApp() {
  const [person, setPerson] = useState(null);
  const [family, setFamily] = useState(null);

  useEffect(() => {
    if (!person?.familyId) { setFamily(null); return; }
    const unsub = subscribeToFamily(person.familyId, setFamily);
    return unsub;
  }, [person?.familyId]);

  return (
    <>
      <div className="w-full h-screen max-w-sm mx-auto overflow-hidden sm:rounded-[2rem] sm:h-[700px] sm:my-8 relative"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
        {!person ? (
          <FamilyAuthScreen onAuthed={setPerson} />
        ) : !person.familyId && !family ? (
          <CreateOrJoinScreen person={person} onFamilyReady={(f) => setPerson({ ...person, familyId: f.id })} />
        ) : family ? (
          <FamilyDashboard person={person} family={family} onLogout={() => { setPerson(null); setFamily(null); }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "#111318" }}>
            <p style={{ color: "#7A7F8A" }}>Loading…</p>
          </div>
        )}
      </div>
      {family && <LiveVideoPanel />}
    </>
  );
}
