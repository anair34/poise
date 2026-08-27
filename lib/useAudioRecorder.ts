"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_DURATION_MS,
  MIN_DURATION_MS,
  WAVEFORM_BAR_COUNT,
  describeMicError,
  isRecordingSupported,
  pickMimeType,
} from "./recording";

type Status = "idle" | "requesting" | "recording";
type StopReason = "finish" | "cancel" | "timeout";

interface UseAudioRecorderOptions {
  onComplete: (blob: Blob, durationSeconds: number) => void;
}

const IDLE_LEVELS = new Array<number>(WAVEFORM_BAR_COUNT).fill(0);

export function useAudioRecorder({ onComplete }: UseAudioRecorderOptions) {
  const [status, setStatus] = useState<Status>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>(IDLE_LEVELS);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const stopReasonRef = useRef<StopReason>("finish");
  const levelsRef = useRef<number[]>(IDLE_LEVELS);

  useEffect(() => {
    setSupported(isRecordingSupported());
  }, []);

  const teardown = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    recorderRef.current = null;
    levelsRef.current = IDLE_LEVELS;
    setLevels(IDLE_LEVELS);
  }, []);

  useEffect(() => teardown, [teardown]);

  /** Rolling RMS amplitude window that drives the waveform bars. */
  const startMetering = useCallback((stream: MediaStream) => {
    let audioContext: AudioContext;
    try {
      audioContext = new AudioContext();
    } catch {
      return; // Visualization is optional; recording continues without it.
    }
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;
    audioContext.createMediaStreamSource(stream).connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    let lastSampleAt = 0;

    const sample = (timestamp: number) => {
      frameRef.current = requestAnimationFrame(sample);
      if (timestamp - lastSampleAt < 55) return;
      lastSampleAt = timestamp;

      analyser.getFloatTimeDomainData(buffer);
      let sumOfSquares = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        sumOfSquares += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumOfSquares / buffer.length);
      // Speech RMS is small; scale and curve it so quiet speech is still legible.
      const level = Math.min(1, Math.pow(rms * 4.2, 0.75));

      const next = [...levelsRef.current.slice(1), level];
      levelsRef.current = next;
      setLevels(next);
    };

    frameRef.current = requestAnimationFrame(sample);
  }, []);

  const finalize = useCallback(
    (reason: StopReason) => {
      const durationMs = Date.now() - startedAtRef.current;
      const chunks = chunksRef.current;
      const mimeType = recorderRef.current?.mimeType || "audio/webm";
      chunksRef.current = [];

      teardown();
      setStatus("idle");
      setElapsedMs(0);

      if (reason === "cancel") return;

      if (durationMs < MIN_DURATION_MS) {
        setError(
          "That was a little short. Give it at least five seconds so we have something to work with.",
        );
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) {
        setError("We didn't capture any audio. Please try again.");
        return;
      }

      onComplete(blob, Math.min(durationMs, MAX_DURATION_MS) / 1000);
    },
    [onComplete, teardown],
  );

  const stop = useCallback((reason: StopReason = "finish") => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    stopReasonRef.current = reason;
    recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (status !== "idle") return;
    setError(null);

    if (!isRecordingSupported()) {
      setSupported(false);
      return;
    }

    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      chunksRef.current = [];
      stopReasonRef.current = "finish";

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        stopReasonRef.current = "cancel";
        setError("Recording stopped unexpectedly. Please try again.");
        finalize("cancel");
      };
      recorder.onstop = () => finalize(stopReasonRef.current);

      recorder.start(250);
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setStatus("recording");
      startMetering(stream);

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        if (elapsed >= MAX_DURATION_MS) {
          setElapsedMs(MAX_DURATION_MS);
          stop("timeout");
          return;
        }
        setElapsedMs(elapsed);
      }, 100);
    } catch (caught) {
      teardown();
      setStatus("idle");
      setError(describeMicError(caught));
    }
  }, [finalize, startMetering, status, stop, teardown]);

  return {
    status,
    isRecording: status === "recording",
    isRequesting: status === "requesting",
    elapsedMs,
    levels,
    error,
    supported,
    start,
    finish: useCallback(() => stop("finish"), [stop]),
    cancel: useCallback(() => stop("cancel"), [stop]),
    clearError: useCallback(() => setError(null), []),
  };
}
