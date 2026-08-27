import type { ScoreKey, Session } from "./types";

export interface ScoreRow {
  key: ScoreKey;
  label: string;
  value: number;
  note?: string;
}

const SCORE_LABELS: Record<ScoreKey, string> = {
  clarity: "Clarity",
  structure: "Structure",
  concision: "Concision",
  delivery: "Delivery",
};

const SCORE_ORDER: ScoreKey[] = [
  "clarity",
  "structure",
  "concision",
  "delivery",
];

/** Coerces anything the analyzer might hand us into a drawable 0–100 score. */
export function safeScore(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(Math.min(100, Math.max(0, numeric)));
}

export function toScoreRows(session: Session): ScoreRow[] {
  return SCORE_ORDER.map((key) => ({
    key,
    label: SCORE_LABELS[key],
    value: safeScore(session.scores?.[key]),
    note: session.scoreNotes?.[key]?.trim() || undefined,
  }));
}

export interface ScoreDelta {
  direction: "up" | "down" | "flat";
  amount: number;
  label: string;
}

export function getScoreDelta(session: Session): ScoreDelta | null {
  if (typeof session.previousScore !== "number") return null;
  if (!Number.isFinite(session.previousScore)) return null;

  const amount = safeScore(session.overallScore) - safeScore(session.previousScore);
  if (amount === 0) {
    return { direction: "flat", amount: 0, label: "Even with your last attempt" };
  }
  // Worded rather than signed, so the direction survives without the arrow or
  // its colour — which is what a screen reader and a monochrome display get.
  return {
    direction: amount > 0 ? "up" : "down",
    amount: Math.abs(amount),
    label: `${Math.abs(amount)} ${amount > 0 ? "up" : "down"} from your last attempt`,
  };
}

/** Formats seconds as m:ss, e.g. 58 -> "0:58". */
export function formatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
