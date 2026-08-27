/**
 * Assertions for scoring v2: the deterministic constraint layer.
 * Run with: node --experimental-strip-types scripts/check-scoring-v2.mjs
 *
 * The question this suite answers is not "is 63 the right score" — no test can
 * settle that. It is whether the *relationships* between responses hold: a
 * fragment must score materially below a complete answer, a repetitive answer
 * must lose concision, and being efficient must not be punished as being
 * incomplete. Those are the properties that make scores feel fair.
 *
 * Every fixture feeds the same optimistic raw scores through the constraints,
 * so any difference in the output is caused by the measurements alone.
 */
import { computeMetrics } from "../lib/scoring/metrics.ts";
import { applyScoreConstraints } from "../lib/scoring/constraints.ts";
import { assessCompleteness } from "../lib/scoring/completeness.ts";
import { SCORING_VERSION } from "../lib/scoring/config.ts";
import { FIXTURES, fixtureById } from "./fixtures/scoring.mjs";

let failures = 0;

function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}` +
      (pass
        ? ""
        : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  );
}

function checkThat(label, condition, detail = "") {
  if (!condition) failures += 1;
  console.log(
    `${condition ? "PASS" : "FAIL"}  ${label}` +
      (condition || !detail ? "" : `\n        ${detail}`),
  );
}

/** Runs one fixture all the way through the pipeline. */
function score(id) {
  const fixture = fixtureById(id);
  const metrics = computeMetrics(fixture.transcript, fixture.durationSeconds);
  return { fixture, metrics, ...applyScoreConstraints(fixture.rawScores, metrics) };
}

const results = new Map(FIXTURES.map((fixture) => [fixture.id, score(fixture.id)]));
const get = (id) => results.get(id);

// ---- Completeness tiers ----------------------------------------------------
check(
  "a 6-second response is insufficient",
  get("6s-fragment").completeness.tier,
  "insufficient",
);
check(
  "a 6-second response is flagged, not silently scored",
  get("6s-fragment").status,
  "insufficient",
);
check(
  "a 10-second response is severely incomplete",
  get("10s-fragment").completeness.tier,
  "severely_incomplete",
);
check(
  "an 18-second response is substantially incomplete",
  get("18s-incomplete").completeness.tier,
  "substantially_incomplete",
);
check(
  "a 55-second response is complete",
  get("55s-normal").completeness.tier,
  "complete",
);
check(
  "a normal-length response is not flagged insufficient",
  get("55s-normal").status,
  "scored",
);

// ---- The bug this version exists to fix ------------------------------------
checkThat(
  "a 10-second response cannot score above 50",
  get("10s-fragment").overallScore <= 50,
  `got ${get("10s-fragment").overallScore}`,
);
checkThat(
  "a 6-second response scores very low",
  get("6s-fragment").overallScore <= 30,
  `got ${get("6s-fragment").overallScore}`,
);
checkThat(
  "the constraints actually moved the 10-second score down",
  get("10s-fragment").overallScore < get("10s-fragment").rawOverallScore,
  `raw ${get("10s-fragment").rawOverallScore}, final ${get("10s-fragment").overallScore}`,
);

// ---- Ordering by completeness ---------------------------------------------
const ladder = [
  "6s-fragment",
  "10s-fragment",
  "18s-incomplete",
  "30s-partial",
  "55s-normal",
];
for (let i = 1; i < ladder.length; i += 1) {
  const shorter = get(ladder[i - 1]);
  const longer = get(ladder[i]);
  checkThat(
    `${ladder[i]} scores above ${ladder[i - 1]}`,
    longer.overallScore > shorter.overallScore,
    `${ladder[i - 1]}=${shorter.overallScore}, ${ladder[i]}=${longer.overallScore}`,
  );
}

checkThat(
  "a 10-second response scores materially below a complete 55-second one",
  get("55s-normal").overallScore - get("10s-fragment").overallScore >= 25,
  `10s=${get("10s-fragment").overallScore}, 55s=${get("55s-normal").overallScore}`,
);

// ---- Structure cannot survive incompleteness -------------------------------
checkThat(
  "a 12-second response cannot score 75 on structure",
  get("12s-clear-incomplete").scores.structure < 75,
  `got ${get("12s-clear-incomplete").scores.structure}`,
);
checkThat(
  "structure is capped harder than clarity when incomplete",
  get("12s-clear-incomplete").scores.structure <
    get("12s-clear-incomplete").scores.clarity,
  `structure=${get("12s-clear-incomplete").scores.structure}, clarity=${get("12s-clear-incomplete").scores.clarity}`,
);

// ---- Short is not concise --------------------------------------------------
checkThat(
  "a short answer is not rewarded for concision",
  get("12s-clear-incomplete").scores.concision <
    get("12s-clear-incomplete").rawScores.concision,
  `raw ${get("12s-clear-incomplete").rawScores.concision}, final ${get("12s-clear-incomplete").scores.concision}`,
);
checkThat(
  "a 10-second answer cannot out-score a complete one on concision",
  get("10s-fragment").scores.concision < get("55s-normal").scores.concision,
  `10s=${get("10s-fragment").scores.concision}, 55s=${get("55s-normal").scores.concision}`,
);

// ---- Clarity is not double-penalised ---------------------------------------
checkThat(
  "a short but clear answer keeps reasonable clarity",
  get("12s-clear-incomplete").scores.clarity >= 45,
  `got ${get("12s-clear-incomplete").scores.clarity}`,
);
checkThat(
  "clarity is not constrained by fillers alone",
  get("60s-filler-heavy").scores.clarity ===
    get("60s-filler-heavy").rawScores.clarity,
  `raw ${get("60s-filler-heavy").rawScores.clarity}, final ${get("60s-filler-heavy").scores.clarity}`,
);
checkThat(
  "clarity is not constrained by pace alone",
  get("60s-very-fast").scores.clarity <= get("60s-very-fast").rawScores.clarity,
);

// ---- Concise but complete is not punished ----------------------------------
check(
  "a dense 35-second answer is upgraded to complete",
  get("35s-concise-complete").completeness.tier,
  "complete",
);
checkThat(
  "a concise complete answer is not penalised for being under 60 seconds",
  get("35s-concise-complete").overallScore ===
    get("35s-concise-complete").rawOverallScore,
  `raw ${get("35s-concise-complete").rawOverallScore}, final ${get("35s-concise-complete").overallScore}`,
);
checkThat(
  "a concise complete answer beats a padded partial one",
  get("35s-concise-complete").overallScore > get("30s-partial").overallScore,
);

// ---- Fillers hit delivery --------------------------------------------------
checkThat(
  "a filler-heavy response scores lower on delivery than a clean one",
  get("60s-filler-heavy").scores.delivery < get("55s-normal").scores.delivery,
  `filler=${get("60s-filler-heavy").scores.delivery}, clean=${get("55s-normal").scores.delivery}`,
);
checkThat(
  "a filler-heavy response is measured as such",
  get("60s-filler-heavy").metrics.fillerRate > 8,
  `rate ${get("60s-filler-heavy").metrics.fillerRate}`,
);
check(
  "a clean response sits in a good filler band",
  ["excellent", "strong"].includes(get("55s-normal").fillerBand),
  true,
);

// ---- Repetition hits concision ---------------------------------------------
checkThat(
  "a repetitive response scores lower on concision than a varied one",
  get("60s-repetitive").scores.concision < get("55s-normal").scores.concision,
  `repetitive=${get("60s-repetitive").scores.concision}, normal=${get("55s-normal").scores.concision}`,
);
checkThat(
  "repetition is actually detected",
  get("60s-repetitive").metrics.repetitionRate > 0.2,
  `rate ${get("60s-repetitive").metrics.repetitionRate}`,
);

// ---- Pace ------------------------------------------------------------------
check(
  "a 240 wpm response is classified very fast",
  get("60s-very-fast").paceBand,
  "very_fast",
);
checkThat(
  "an extremely fast response loses delivery",
  get("60s-very-fast").scores.delivery < get("60s-very-fast").rawScores.delivery,
  `raw ${get("60s-very-fast").rawScores.delivery}, final ${get("60s-very-fast").scores.delivery}`,
);
check(
  "a normal response sits in the comfortable pace band",
  get("55s-normal").paceBand,
  "comfortable",
);
checkThat(
  "an extremely fast response is flagged as rushed",
  get("60s-very-fast").completeness.isRushed,
);

// ---- Excellent responses can still score well ------------------------------
checkThat(
  "an excellent complete response is left alone by the constraints",
  get("60s-excellent").overallScore === get("60s-excellent").rawOverallScore,
  `raw ${get("60s-excellent").rawOverallScore}, final ${get("60s-excellent").overallScore}`,
);
checkThat(
  "an excellent response scores in the 90s",
  get("60s-excellent").overallScore >= 90,
  `got ${get("60s-excellent").overallScore}`,
);
checkThat(
  "a long structured response is not penalised for length",
  get("60s-long-structured").scores.structure ===
    get("60s-long-structured").rawScores.structure,
);

// ---- Constraints are ceilings, never boosts --------------------------------
for (const [id, result] of results) {
  const raised = ["clarity", "structure", "concision", "delivery"].filter(
    (key) => result.scores[key] > result.rawScores[key],
  );
  checkThat(`${id}: no dimension was raised above the model's score`, raised.length === 0, `raised ${raised.join(", ")}`);
}

// ---- Word count matters alongside duration ---------------------------------
const dense20s = assessCompleteness({
  durationSeconds: 20,
  wordCount: 100,
  wordsPerMinute: 300,
});
const sparse20s = assessCompleteness({
  durationSeconds: 20,
  wordCount: 25,
  wordsPerMinute: 75,
});
checkThat(
  "20 seconds with 100 words outranks 20 seconds with 25 words",
  dense20s.caps.structure > sparse20s.caps.structure,
  `dense=${dense20s.tier}, sparse=${sparse20s.tier}`,
);
check("dense speech at 20s is flagged rushed", dense20s.isRushed, true);

const sparse55s = assessCompleteness({
  durationSeconds: 55,
  wordCount: 30,
  wordsPerMinute: 33,
});
check(
  "55 seconds of mostly silence drops a tier",
  sparse55s.tier,
  "partial",
);
checkThat(
  "a downgrade explains itself",
  typeof sparse55s.adjustment === "string" && sparse55s.adjustment.length > 0,
);

// ---- Metadata --------------------------------------------------------------
check("the scoring version is stamped", get("55s-normal").scoringVersion, SCORING_VERSION);
checkThat(
  "applied caps are recorded for debugging",
  get("10s-fragment").appliedCaps.length > 0,
);
checkThat(
  "every applied cap explains itself",
  get("10s-fragment").appliedCaps.every(
    (cap) => typeof cap.reason === "string" && cap.reason.length > 0,
  ),
);
check(
  "an unconstrained response records no caps",
  get("60s-excellent").appliedCaps.length,
  0,
);

// ---- Sentence statistics ---------------------------------------------------
checkThat(
  "sentences are counted",
  get("55s-normal").metrics.sentenceCount === 8,
  `got ${get("55s-normal").metrics.sentenceCount}`,
);
checkThat(
  "average sentence length is computed",
  get("55s-normal").metrics.averageSentenceLength > 0,
);
checkThat(
  "sentence length variance is computed",
  get("55s-normal").metrics.sentenceLengthVariance >= 0,
);

console.log(
  failures === 0
    ? "\nAll checks passed."
    : `\n${failures} check${failures === 1 ? "" : "s"} failed.`,
);
process.exit(failures === 0 ? 0 : 1);
