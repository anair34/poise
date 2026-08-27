# Screenshots

Screenshots referenced by the root `README.md`. Add PNGs here using exactly these
filenames, then swap them into the README where marked.

The Demo section near the top of the README holds a hero image and two
three-column grids. Two further screenshots sit inline in the walkthrough,
because they carry more detail than a grid cell can show.

| File | Screen | Used in | Notes |
| --- | --- | --- | --- |
| `results.png` | `/results/[id]` | Demo hero | Score hero through the coaching block. Worth a tall capture. |
| `landing.png` | `/` | Demo grid 1 | Hero and the entry point into today's challenge. |
| `signin.png` | `/signin` | Demo grid 1 | Email and password form with the Google button. |
| `practice.png` | `/practice` | Demo grid 1 | The prompt and the recorder at rest. |
| `recording.png` | `/practice` | Demo grid 2 | Mid-recording, with the live waveform moving. |
| `quests.png` | `/conversations` | Demo grid 2 | The two daily quests, ideally with one complete. |
| `progress.png` | `/conversations` | Demo grid 2 | Dashboard summary: streak, level, quests, challenge state. |
| `beat-your-score.png` | `/results/[id]` | Inline, step 6 | The retry CTA, or the comparison table on a completed retry. |
| `calendar.png` | `/conversations` | Inline, step 7 | The practice calendar with a day selected. |
| `google-signin.png` | Google OAuth popup | Unused | Optional. Add a cell for it only if it shows more than `signin.png`. |

In the Demo grids, replace a placeholder cell like this:

```html
<td align="center"><code>docs/images/landing.png</code></td>
```

with the image:

```html
<td><img src="docs/images/landing.png" alt="Poise landing page"></td>
```

Capture guidance:

- Use a viewport around 1440px wide for desktop shots, then crop to the content.
  Full-height browser captures make the README hard to scan.
- Sign in with an account that has a few days of history. Empty states
  photograph badly and undersell the product.
- `POISE_SCORING_MODE=mock` produces a complete results page without spending
  OpenAI credits, which is usually the easiest way to capture `results.png`.
- Avoid capturing a real email address in the account menu.
