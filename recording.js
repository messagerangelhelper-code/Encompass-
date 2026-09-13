// Real, on-device audio/video recording via the browser's MediaRecorder API.
// Nothing here ever leaves the device — recordings are saved to IndexedDB
// (see recordingsStore.js) and are only ever accessed locally.

let activeStream = null;
let activeRecorder = null;
let activeChunks = [];

/**
 * Requests real camera/microphone permission from the browser and starts
 * recording. Returns null (and leaves the trip unaffected) if permission is
 * denied or unsupported — recording is a bonus, never something that should
 * block a ride.
 *
 * @param {{ audio: boolean, video: boolean }} opts
 * @returns {Promise<boolean>} true if recording actually started
 */
export async function startRecording({ audio, video }) {
  if (!audio && !video) return false;
  if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
    console.log("Recording not supported on this device/browser.");
    return false;
  }
  if (activeRecorder) return true; // already recording

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({ audio, video });
  } catch (err) {
    console.log("Recording permission denied or unavailable:", err.message);
    return false;
  }

  try {
    const mimeType = video
      ? (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm")
      : (MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm");

    activeChunks = [];
    activeRecorder = new MediaRecorder(activeStream, { mimeType });
    activeRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) activeChunks.push(e.data);
    };
    activeRecorder.start(1000); // collect in 1-second chunks
    return true;
  } catch (err) {
    console.log("Couldn't start recorder:", err.message);
    stopStream();
    return false;
  }
}

function stopStream() {
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop());
    activeStream = null;
  }
}

/**
 * Stops the current recording (if any) and returns the finished Blob, along
 * with what kind of recording it was. Safe to call even if nothing was
 * recording — returns null.
 */
export function stopRecording() {
  return new Promise((resolve) => {
    if (!activeRecorder) {
      resolve(null);
      return;
    }
    const mimeType = activeRecorder.mimeType || "video/webm";
    activeRecorder.onstop = () => {
      const blob = new Blob(activeChunks, { type: mimeType });
      activeChunks = [];
      activeRecorder = null;
      stopStream();
      resolve(blob.size > 0 ? { blob, mimeType } : null);
    };
    try {
      activeRecorder.stop();
    } catch (e) {
      activeRecorder = null;
      stopStream();
      resolve(null);
    }
  });
}

export function isRecordingSupported() {
  return typeof window !== "undefined" && "mediaDevices" in navigator && !!window.MediaRecorder;
}
