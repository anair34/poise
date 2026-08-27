/**
 * Scoring audit: input -> metrics -> raw scores -> constraints -> final.
 * Run with: node --experimental-strip-types scripts/audit-scoring.mjs
 *
 * Development only. Reads the checked-in fixtures, never production data, so it
 * cannot print a real user's transcript. When scoring feels wrong, change a
 * threshold in `lib/scoring/config.ts` and run this to see what moved.
 *
 *   node --experimental-strip-types scripts/audit-scoring.mjs            all
 *   node --experimental-strip-types scripts/audit-scoring.mjs 10s        matching
 *   node --experimental-strip-types scripts/audit-scoring.mjs --summary  one line each
 */
import { computeMetrics } from "../lib/scoring/metrics.ts";
import { applyScoreConstraints } from "../lib/scoring/constraints.ts";
import { FIXTURES } from "./fixtures/scoring.mjs";

const args = process.argv.slice(2);
const summaryOnly = args.includes("--summary");
const filters = args.filter((arg) => !arg.startsWith("--"));

const selected = filters.length
  ? FIXTURES.filter((fixture) =>
      filters.some(
        (filter) => fixture.id.includes(filter) || fixture.label.includes(filter),
      ),
    )
  : FIXTURES;

const DIMENSIONS = ["clarity", "structure", "concision", "delivery"];

function pad(value, width) {
  return String(value).padEnd(width);
}

function padStart(value, width) {
  return String(value).padStart(width);
}

function summarize(fixture, result) {
  const moved = result.rawOverallScore - result.overallScore;
  console.log(
    `${pad(fixture.id, 24)} ${padStart(result.overallScore, 3)}  ` +
      `(raw ${padStart(result.rawOverallScore, 3)}${moved > 0 ? `, -${moved}` : "     "})  ` +
      `${pad(result.completeness.tier, 26)} ${pad(result.paceBand, 12)} ${result.status}`,
  );
}

function detail(fixture, result) {
  const { metrics } = result;

  console.log(`\n${"=".repeat(78)}`);
  console.log(`${fixture.label}  [${fixture.id}]`);
  console.log("=".repeat(78));

  console.log(`\nTRANSCRIPT (${fixture.durationSeconds}s)`);
  console.log(`  "${fixture.transcript.slice(0, 150)}${fixture.transcript.length > 150 ? "…" : ""}"`);

  console.log("\nDETERMINISTIC METRICS");
  console.log(`  duration            ${metrics.durationSeconds}s`);
  console.log(`  words               ${metrics.wordCount}`);
  console.log(`  pace                ${metrics.wordsPerMinute} wpm  (${result.paceBand})`);
  console.log(`  fillers             ${metrics.fillerWordCount}  rate ${metrics.fillerRate}/100w  (${result.fillerBand})`);
  console.log(`  hedges              ${metrics.hedgeCount}  rate ${metrics.hedgeRate}/100w`);
  console.log(`  repetition          ${(metrics.repetitionRate * 100).toFixed(1)}% of trigrams`);
  console.log(`  lexical diversity   ${(metrics.lexicalDiversity * 100).toFixed(1)}%`);
  console.log(`  sentences           ${metrics.sentenceCount}, avg ${metrics.averageSentenceLength} words, variance ${metrics.sentenceLengthVariance}`);

  console.log("\nCOMPLETENESS");
  console.log(`  tier                ${result.completeness.tier}  (${result.completeness.label})`);
  console.log(`  from duration       ${result.completeness.durationTier}`);
  if (result.completeness.adjustment) {
    console.log(`  adjusted because    ${result.completeness.adjustment}`);
  }
  console.log(`  rushed              ${result.completeness.isRushed}`);

  console.log("\nSCORES");
  console.log(`  ${pad("dimension", 12)} ${padStart("raw", 5)} ${padStart("final", 6)}  change`);
  for (const dimension of DIMENSIONS) {
    const raw = result.rawScores[dimension];
    const final = result.scores[dimension];
    const change = final === raw ? "" : `capped -${raw - final}`;
    console.log(`  ${pad(dimension, 12)} ${padStart(raw, 5)} ${padStart(final, 6)}  ${change}`);
  }
  console.log(`  ${pad("OVERALL", 12)} ${padStart(result.rawOverallScore, 5)} ${padStart(result.overallScore, 6)}  ` +
    `${result.overallScore === result.rawOverallScore ? "" : `capped -${result.rawOverallScore - result.overallScore}`}`);

  console.log("\nAPPLIED CONSTRAINTS");
  if (result.appliedCaps.length === 0) {
    console.log("  none — the model's scores stood");
  } else {
    for (const cap of result.appliedCaps) {
      console.log(`  ${pad(cap.dimension, 12)} ${cap.from} -> ${cap.cap}   ${cap.reason}`);
    }
  }

  console.log(`\nSTATUS  ${result.status}   VERSION  ${result.scoringVersion}`);
}

if (summaryOnly) {
  console.log(
    `${pad("fixture", 24)} ${padStart("final", 3)}  ${pad("(raw)", 16)} ${pad("tier", 26)} ${pad("pace", 12)} status`,
  );
  console.log("-".repeat(100));
}

for (const fixture of selected) {
  const metrics = computeMetrics(fixture.transcript, fixture.durationSeconds);
  const result = { metrics, ...applyScoreConstraints(fixture.rawScores, metrics) };

  if (summaryOnly) summarize(fixture, result);
  else detail(fixture, result);
}

if (!summaryOnly) console.log("");
