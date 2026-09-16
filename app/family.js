"use client";
export const dynamic = "force-dynamic";
import ShareQRCode from "../ShareQRCode";
import LiveTrackingMap from "../LiveTrackingMap";
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
