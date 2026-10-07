"use client";
import Link from "next/link";
import { Car, User, Building2 } from "lucide-react";
import { ACCENT, BG, CARD, BORDER, TEXT, MUTED } from "../lib/tokens";

// This is the site's actual homepage — without it, the bare domain (what
// "Try Encompass" on the CashCow marketing site links to) has nothing to
// render and 404s. It just routes people to the right experience:
// the rider/driver app, or the no-signup hotel booking portal.
export default function Home() {
  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-10"
      style={{ background: BG }}
    >
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold mb-1" style={{ color: TEXT }}>Encompass</h1>
        <p className="text-sm mb-10" style={{ color: MUTED }}>Rideshare, on your terms.</p>

        <div className="space-y-3">
          <Link
            href="/rider"
            className="w-full flex items-center gap-3 px-5 py-4 rounded-xl"
            style={{ background: ACCENT, color: "#111318" }}
          >
            <User size={20} />
            <div className="text-left">
              <p className="text-sm font-semibold">I need a ride</p>
              <p className="text-xs opacity-80">Sign in and request a ride</p>
            </div>
          </Link>

          <Link
            href="/driver"
            className="w-full flex items-center gap-3 px-5 py-4 rounded-xl"
            style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
          >
            <Car size={20} />
            <div className="text-left">
              <p className="text-sm font-semibold">I'm a driver</p>
              <p className="text-xs" style={{ color: MUTED }}>Sign in to accept rides</p>
            </div>
          </Link>

          <Link
            href="/hotel"
            className="w-full flex items-center gap-3 px-5 py-4 rounded-xl"
            style={{ background: CARD, color: TEXT, border: `1px solid ${BORDER}` }}
          >
            <Building2 size={20} />
            <div className="text-left">
              <p className="text-sm font-semibold">Booking from a hotel?</p>
              <p className="text-xs" style={{ color: MUTED }}>No app needed — book and pay in your browser</p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
