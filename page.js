"use client";

import { Fuel, ShoppingCart, ExternalLink, Info } from "lucide-react";
import { ACCENT, AMBER } from "../../lib/tokens";

/* =========================================================================
   EVERYDAY SAVINGS — /savings
   -------------------------------------------------------------------------
   Curates two REAL, existing rebate programs into one page — especially
   relevant for Encompass drivers, who spend on gas every single day.
   This is NOT a new financial product; it's a curated links page, same
   idea as any "best cashback apps" roundup.

   BEFORE THIS GOES LIVE:
   1. Apply to Ibotta's affiliate program and Upside's affiliate program
      (not just personal referral codes, once you're promoting beyond
      friends/family).
   2. Replace the two placeholder URLs below with your real approved
      affiliate links.
   3. Keep the disclosure block — the FTC requires clear disclosure any
      time you earn money from links you share.

   File location: app/savings/page.js
   No nav link needed — share the direct encompassrs.com/savings URL
   wherever you want (driver group chats, app notifications, etc.)
   ========================================================================= */

// TODO: replace with your real approved affiliate links once accepted.
const IBOTTA_LINK = "https://ibotta.com";
const UPSIDE_LINK = "https://upside.com";

function Card({ icon, title, blurb, bullets, href, color }) {
  return (
    <div className="flex-1 min-w-[280px] rounded-2xl p-6" style={{ background: "#1D2028", border: "1px solid #2B2F3A" }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: `${color}22` }}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: "#F5F5F0" }}>{title}</h3>
      <p className="text-sm mb-4 leading-relaxed" style={{ color: "#9CA0AA" }}>{blurb}</p>
      <ul className="text-xs mb-6 space-y-1.5 list-disc pl-4" style={{ color: "#7A7F8A" }}>
        {bullets.map((b) => <li key={b}>{b}</li>)}
      </ul>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
        style={{ background: color, color: "#111318" }}
      >
        Get Started <ExternalLink size={14} />
      </a>
    </div>
  );
}

export default function SavingsPage() {
  return (
    <div className="min-h-screen w-full px-6 py-16" style={{ background: "#111318" }}>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: ACCENT }}>Encompass Savings</p>
          <h1 className="text-3xl md:text-4xl font-semibold mb-3" style={{ color: "#F5F5F0" }}>
            Save on the things you already buy.
          </h1>
          <p className="text-sm md:text-base max-w-lg mx-auto" style={{ color: "#9CA0AA" }}>
            Gas and groceries — two real cashback programs, bundled in one place, especially useful if you're driving every day.
          </p>
        </div>

        <div className="flex gap-5 flex-wrap mb-8">
          <Card
            icon={<Fuel size={20} color={ACCENT} />}
            title="Gas Cashback — Upside"
            blurb="Real cash back every time you fill up, funded by the gas station — not by other members. Built for people who drive a lot."
            bullets={["Free to join", "Cash back on every fill-up", "No monthly fee"]}
            href={UPSIDE_LINK}
            color={ACCENT}
          />
          <Card
            icon={<ShoppingCart size={20} color={AMBER} />}
            title="Grocery & Retail Cashback — Ibotta"
            blurb="Cash back at Walmart, Target, Kroger, and 300+ other stores on things you're already buying."
            bullets={["Free to join", "300+ participating stores", "Cash out anytime"]}
            href={IBOTTA_LINK}
            color={AMBER}
          />
        </div>

        <div className="rounded-xl p-4 flex gap-3" style={{ background: "#1D2028", border: "1px solid #2B2F3A" }}>
          <Info size={16} color="#7A7F8A" className="flex-shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed" style={{ color: "#7A7F8A" }}>
            <strong style={{ color: "#9CA0AA" }}>Disclosure:</strong> The links above are referral/affiliate links. If you sign up through them, Encompass may earn a commission from Upside or Ibotta at no extra cost to you — this doesn't affect the cash back you earn. We don't operate, control, or guarantee either program; all rewards are provided directly by Upside and Ibotta under their own terms.
          </p>
        </div>
      </div>
    </div>
  );
}
