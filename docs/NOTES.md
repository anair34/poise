# Build notes

## Locked decision: `/practice` must match the landing page mockup exactly

The recorder preview in `components/marketing/RecorderMockup.tsx` is the
canonical design for the real `/practice` interface. When building the live
recorder, treat that mockup as the spec — same layout, spacing, type scale, and
component order — not as loose inspiration.

Required parity:

- Header row: `Day {n}` + category on the left, `{n} day streak 🔥` badge on the right
- `TODAY'S CHALLENGE` label above the prompt, same uppercase tracking treatment
- Prompt in the same size/weight/measure
- Circular ember mic button, same diameter, with the expanding ring on record
- Monospace tabular timer counting `01:00` down to `00:00`
- Waveform directly beneath the timer, same bar width/gap/height envelope
- Footer row with `Cancel` and `Finish →`

Differences allowed only where interaction demands it: the waveform must be
driven by real mic amplitude via `AnalyserNode` instead of the fixed amplitude
array, the timer must actually count down and auto-stop at zero, and the mic
button/controls change with the `ready | recording | processing` state.

Ideally `RecorderMockup` and the live recorder share the same presentational
subcomponents so the two can never drift apart.
