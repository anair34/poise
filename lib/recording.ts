export const MAX_DURATION_MS = 60_000;
export const MIN_DURATION_MS = 5_000;
export const WAVEFORM_BAR_COUNT = 36;

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** Picks the first container the current browser can actually encode. */
export function pickMimeType(): string | undefined {
  if (typeof window.MediaRecorder?.isTypeSupported !== "function") {
    return undefined;
  }
  return PREFERRED_MIME_TYPES.find((type) =>
    window.MediaRecorder.isTypeSupported(type),
  );
}

export function fileExtensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function describeMicError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Something went wrong reaching your microphone. Please try again.";
  }
  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone access is blocked. Allow it in your browser settings, then try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone found. Connect one and try again.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your microphone is busy in another app. Close it and try again.";
    default:
      return "Recording failed to start. Please try again.";
  }
}
