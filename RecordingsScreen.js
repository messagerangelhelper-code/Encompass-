"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, Play, Trash2, Video, Mic } from "lucide-react";
import { listRecordings, deleteRecording } from "../lib/recordingsStore";

export default function RecordingsScreen({ onBack, accentColor = "#6C5CE7" }) {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const [playUrl, setPlayUrl] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await listRecordings();
      setRecordings(all);
    } catch (e) {
      console.log("Couldn't load recordings:", e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    return () => {
      if (playUrl) URL.revokeObjectURL(playUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlay = (rec) => {
    if (playUrl) URL.revokeObjectURL(playUrl);
    const url = URL.createObjectURL(rec.blob);
    setPlayUrl(url);
    setPlayingId(rec.id);
  };

  const handleDelete = async (id) => {
    await deleteRecording(id);
    if (playingId === id) {
      setPlayingId(null);
      if (playUrl) URL.revokeObjectURL(playUrl);
      setPlayUrl(null);
    }
    load();
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full h-full flex flex-col" style={{ background: "#F5F5F0" }}>
      <div className="flex items-center gap-3 p-4 pt-6">
        <button onClick={onBack} aria-label="Back" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#EDEBE2" }}>
          <ChevronLeft size={18} color="#111318" />
        </button>
        <h2 className="text-base font-semibold" style={{ color: "#111318" }}>My Recordings</h2>
      </div>

      <div className="px-4 mt-2 flex-1 overflow-y-auto pb-6">
        {loading && <p className="text-sm text-center mt-8" style={{ color: "#7A7F8A" }}>Loading…</p>}

        {!loading && recordings.length === 0 && (
          <div className="text-center mt-10 px-4">
            <p className="text-sm" style={{ color: "#7A7F8A" }}>
              No recordings yet. When audio or video recording is on in Safety Toolkit, trips will be saved here — only on this device.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {recordings.map((rec) => (
            <div key={rec.id} className="rounded-xl p-3" style={{ background: "#fff", border: "1px solid #E4E2D9" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accentColor}22` }}>
                  {rec.kind === "video" ? <Video size={16} color={accentColor} /> : <Mic size={16} color={accentColor} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#111318" }}>{rec.destination}</p>
                  <p className="text-xs" style={{ color: "#7A7F8A" }}>
                    {new Date(rec.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {" · "}{formatSize(rec.sizeBytes)}
                  </p>
                </div>
                <button onClick={() => handlePlay(rec)} aria-label="Play"
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EDEBE2" }}>
                  <Play size={15} color="#111318" />
                </button>
                <button onClick={() => handleDelete(rec.id)} aria-label="Delete"
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#EDEBE2" }}>
                  <Trash2 size={15} color="#C0392B" />
                </button>
              </div>
              {playingId === rec.id && playUrl && (
                <div className="mt-3">
                  {rec.kind === "video" ? (
                    <video src={playUrl} controls autoPlay className="w-full rounded-lg" style={{ maxHeight: 220, background: "#000" }} />
                  ) : (
                    <audio src={playUrl} controls autoPlay className="w-full" />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
