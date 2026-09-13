"use client";

import { useState } from "react";
import { Phone, X } from "lucide-react";
import { ACCENT } from "../lib/tokens";

/* =========================================================================
   HOW TO BOOK — 1-2-3 popup
   -------------------------------------------------------------------------
   Matches the app's existing dark theme (ACCENT token, #1D2028 cards).

   Usage — save this file as components/HowToBookModal.js, then in any
   page (rider or hotel):

     import HowToBookModal from "../../components/HowToBookModal";
     ...
     <HowToBookModal phone="4693097655" />

   `phone` should be digits only (no dashes/spaces/parens) so the tel:
   link works correctly on mobile.
   ========================================================================= */

function formatPhone(digits) {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 10) return digits;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function HowToBookModal({ phone = "4693097655" }) {
  const [open, setOpen] = useState(false);
  const displayPhone = formatPhone(phone);

  const steps = [
    {
      number: 1,
      title: "Call to get started",
      body: `Call ${displayPhone} and we'll help you get set up.`,
      action: (
        <a
          href={`tel:+1${phone}`}
          className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-full text-sm font-semibold"
          style={{ background: ACCENT, color: "#111318" }}
        >
          <Phone size={14} /> Call {displayPhone}
        </a>
      ),
    },
    {
      number: 2,
      title: "Book your trip",
      body: "Tell us your pickup and where you're headed — we'll confirm your ride.",
    },
    {
      number: 3,
      title: "Get picked up",
      body: "Your driver will meet you at pickup and take you where you need to go.",
    },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
        style={{ background: "#1D2028", color: ACCENT, border: `1px solid ${ACCENT}` }}
      >
        How to book
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#1D2028", border: "1px solid #2B2F3A" }}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-lg font-semibold" style={{ color: "#F5F5F0" }}>How to Book</span>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X size={18} color="#7A7F8A" />
              </button>
            </div>

            {steps.map((s, i) => (
              <div key={s.number} className="flex gap-3" style={{ marginBottom: i < steps.length - 1 ? 18 : 0 }}>
                <div
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: ACCENT, color: "#111318" }}
                >
                  {s.number}
                </div>
                <div>
                  <div className="font-semibold text-sm mb-0.5" style={{ color: "#F5F5F0" }}>{s.title}</div>
                  <div className="text-sm" style={{ color: "#7A7F8A" }}>{s.body}</div>
                  {s.action}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
