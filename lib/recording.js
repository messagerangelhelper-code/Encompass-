let mediaRecorder = null;
let recordedChunks = [];
let activeStream = null;

export async function startRecording({ audio = true, video = false } = {}) {
  try {
    activeStream = await navigator.mediaDevices.getUserMedia({ audio, video });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(activeStream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.start();
    return true;
  } catch (err) {
    console.log("Couldn't start recording:", err.message);
    return false;
  }
}

export async function stopRecording() {
  if (!mediaRecorder) return null;

  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const mimeType = mediaRecorder.mimeType || "video/webm";
      const blob = new Blob(recordedChunks, { type: mimeType });
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
        activeStream = null;
      }
      mediaRecorder = null;
      recordedChunks = [];
      resolve({ blob, mimeType });
    };
    mediaRecorder.stop();
  });
}
