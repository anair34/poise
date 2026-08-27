import { cn } from "@/lib/cn";

/**
 * The O in POISE, drawn as a microphone grille.
 *
 * Vertical slots rather than a literal mic silhouette: a mic small enough to sit
 * inside a letter turns to mush, whereas slots in a ring read as a studio grille
 * at any size — and double as a waveform, which is the app's own visual
 * language (see components/practice/Waveform.tsx).
 *
 * Alignment is deterministic rather than eyeballed. The svg is an inline
 * replaced element, so `vertical-align: baseline` puts its bottom edge on the
 * text baseline. Sizing it to the cap height therefore makes it sit exactly
 * where a capital O would, at any font size, without magic offsets.
 */
const CAP_HEIGHT = "0.72em";

export function MicO({
  className,
  accent = "var(--color-ember)",
}: {
  className?: string;
  accent?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      className={cn("inline-block", className)}
      style={{
        width: CAP_HEIGHT,
        height: CAP_HEIGHT,
        verticalAlign: "baseline",
      }}
    >
      {/* The counter of the O. Stroke 3 on a 24 grid matches the stem weight of
          Geist at semibold, so the ring doesn't read lighter than the letters. */}
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      {/* Grille slots, tallest at the centre so it also scans as a waveform. */}
      <g stroke={accent} strokeWidth="1.6" strokeLinecap="round">
        <path d="M7.2 10v4" />
        <path d="M9.6 8.6v6.8" />
        <path d="M12 7.6v8.8" />
        <path d="M14.4 8.6v6.8" />
        <path d="M16.8 10v4" />
      </g>
    </svg>
  );
}

/**
 * The POISE wordmark with the microphone set into the O.
 *
 * Uppercase and tracked out: the extra letter-spacing is doing real work, since
 * a drawn circle and the typeface's own O will never have identical sidebearings,
 * and generous tracking makes that difference invisible.
 */
export function PoiseWordmark({
  className,
  accent,
}: {
  className?: string;
  accent?: string;
}) {
  return (
    <span
      className={cn(
        "font-semibold uppercase tracking-[0.08em] text-ink",
        className,
      )}
    >
      {/* aria-label on the wrapper, so assistive tech reads the brand name once
          rather than "P I S E" around a decorative glyph. */}
      <span aria-hidden>
        P<MicO accent={accent} />
        ISE
      </span>
      <span className="sr-only">Poise</span>
    </span>
  );
}

/**
 * The logo, everywhere.
 *
 * One composition only: the embedded microphone already says "voice", so
 * pairing the wordmark with a separate mic mark reads as two microphones.
 * Callers vary the size via `className`; nothing else about it changes.
 */
export function PoiseLogo({ className }: { className?: string }) {
  return <PoiseWordmark className={className} />;
}
