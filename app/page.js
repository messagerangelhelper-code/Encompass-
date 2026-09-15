"use client";
import Link from "next/link";
import { ACCENT } from "../lib/tokens";

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#111318" }}>
      <h1 className="text-3xl font-bold mb-2" style={{ color: "#F5F5F0" }}>Encompass</h1>
      <p className="text-sm mb-10" style={{ color: "#7A7F8A" }}>Rideshare, on your terms.</p>

      <div className="w-full max-w-xs space-y-3">
        <Link href="/rider">
          <button className="w-full py-4 rounded-xl text-sm font-semibold" style={{ background: ACCENT, color: "#111318" }}>
            I'm a Rider
          </button>
        </Link>
        <Link href="/driver">
          <button className="w-full py-4 rounded-xl text-sm font-semibold" style={{ background: "#1D2028", color: ACCENT, border: `1px solid ${ACCENT}` }}>
            I'm a Driver
          </button>
        </Link>
      </div>
    </main>
  );
}
