"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, Send } from "lucide-react";
import { ACCENT } from "../lib/tokens";
import { subscribeToRideMessages, appendRideMessage } from "../lib/supabase-db";
export default function ChatPanel({ rideId, mySender, otherName, quickReplies, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

useEffect(() => {
  const unsub = subscribeToRideMessages(rideId, setMessages);
  return unsub;
}, [rideId]);

  const send = async (t) => {
    const trimmed = t.trim();
    if (!trimmed) return;
    setText("");
    await appendRideMessage(rideId, mySender, trimmed);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col" style={{ background: "#111318" }}>
      <div className="flex items-center gap-3 p-4 pt-6" style={{ borderBottom: "1px solid #2B2F3A" }}>
        <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#1D2028" }}>
          <ChevronLeft size={18} color="#F5F5F0" />
        </button>
        <h2 className="text-base font-semibold" style={{ color: "#F5F5F0" }}>{otherName || "Chat"}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-center mt-6" style={{ color: "#7A7F8A" }}>No messages yet — say hello.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === mySender ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[75%] px-3.5 py-2 rounded-2xl text-sm"
              style={{
                background: m.sender === mySender ? ACCENT : "#1D2028",
                color: m.sender === mySender ? "#111318" : "#F5F5F0",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 pb-6" style={{ borderTop: "1px solid #2B2F3A" }}>
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {(quickReplies || []).map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0"
              style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(text); }}
            placeholder="Message…"
            className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: "#1D2028", color: "#F5F5F0", border: "1px solid #2B2F3A" }}
          />
          <button
            onClick={() => send(text)}
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: ACCENT }}
          >
            <Send size={17} color="#111318" />
          </button>
        </div>
      </div>
    </div>
  );
}
