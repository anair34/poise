import { ArrowGlyph, Button } from "@/components/ui/Button";

/**
 * The retry invitation, as the page's strongest call to action.
 *
 * It names the number to beat and the one thing to change, because "try again"
 * without either is just a button. The tone stays an invitation rather than a
 * push: there is no countdown, no streak-at-risk warning, and no second
 * competing action inside this block.
 */
export function BeatYourScore({
  sessionId,
  promptId,
  scoreToBeat,
  focus,
}: {
  sessionId: string;
  promptId: string;
  scoreToBeat: number;
  /** The coaching title to carry into the next attempt, if there was one. */
  focus?: string;
}) {
  return (
    <section className="rounded-3xl border border-hairline bg-canvas px-6 py-8 sm:px-10 sm:py-10">
      {/* A heading, not a styled paragraph: this block has no other title, and
          the page's outline should not skip it. */}
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-ember">
        Beat your score
      </h2>

      <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
          <div>
            <p className="text-[0.74rem] uppercase tracking-[0.14em] text-ink-muted">
              Score to beat
            </p>
            <p className="mt-2 font-mono text-[clamp(2.4rem,5vw,3.2rem)] font-medium leading-none tabular-nums text-ink">
              {scoreToBeat}
            </p>
          </div>

          {focus ? (
            <div className="min-w-0 max-w-sm">
              <p className="text-[0.74rem] uppercase tracking-[0.14em] text-ink-muted">
                Focus on
              </p>
              <p className="mt-2 text-[1.05rem] leading-[1.45] text-ink">
                {focus}
              </p>
            </div>
          ) : null}
        </div>

        <div className="shrink-0">
          <Button href={`/practice?prompt=${promptId}&retryOf=${sessionId}`}>
            Try again <ArrowGlyph />
          </Button>
          <p className="mt-3 text-[0.85rem] text-ink-muted">
            Same prompt. One improvement.
          </p>
        </div>
      </div>
    </section>
  );
}
