/**
 * Quick assertions for the deterministic scoring helpers.
 * Run with: node --experimental-strip-types scripts/check-scoring.mjs
 */
import {
  computeLexicalDiversity,
  computeMetrics,
  computeRepetitionRate,
  computeWordsPerMinute,
  countFillers,
  countHedges,
  countWords,
  isTranscriptUsable,
} from "../lib/scoring/metrics.ts";
import { clampScore, computeOverallScore } from "../lib/scoring/constraints.ts";

let failures = 0;

function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures += 1;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}` +
      (pass ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  );
}

// Filler detection must not fire inside unrelated words.
check(
  "no false positives in 'likely, unlike, actualization, ummm-free'",
  countFillers("It was likely unlike any actualization of that idea.").total,
  0,
);
check(
  "counts stretched hesitations (ummm, uhh)",
  countFillers("Ummm, I think, uhh, yes.").total,
  2,
);
check(
  "counts multi-word fillers",
  countFillers("You know, I mean, it's sort of kind of fine.").total,
  4,
);
check(
  "'like' as a verb is not a filler",
  countFillers("I like it and we like them.").total,
  0,
);
check(
  "'like' as a discourse filler is caught",
  countFillers("It was, like, completely different.").total,
  1,
);
check(
  "breakdown is sorted by count",
  countFillers("basically basically actually").breakdown,
  [
    { word: "basically", count: 2 },
    { word: "actually", count: 1 },
  ],
);

// Hedging.
check(
  "counts hedge phrases",
  countHedges("Maybe I think it was probably fine, sort of."),
  4,
);
check("no hedges in a direct statement", countHedges("Ship it every day."), 0);

// Lexical diversity: unique words over total.
check("all-unique words score 1", computeLexicalDiversity("one two three"), 1);
check(
  "repeated words lower diversity",
  computeLexicalDiversity("word word word word"),
  0.25,
);
check("empty transcript has no diversity", computeLexicalDiversity("   "), 0);

// Repetition: share of repeated three-word sequences.
check("no repetition in distinct phrasing", computeRepetitionRate("a b c d e f"), 0);
check(
  "catches a repeated phrase",
  computeRepetitionRate("the point is the point is") > 0,
  true,
);
check("too short to have trigrams", computeRepetitionRate("two words"), 0);

// Word counting ignores standalone punctuation.
check("counts words, skipping bare punctuation", countWords("Hello there — friend ."), 3);
check("empty transcript is zero words", countWords("   "), 0);

// WPM math.
check("wpm = words / (seconds / 60)", computeWordsPerMinute(140, 60), 140);
check("wpm handles partial minutes", computeWordsPerMinute(70, 30), 140);
check("wpm guards divide-by-zero", computeWordsPerMinute(100, 0), 0);

// Overall score weighting: 0.30/0.25/0.25/0.20.
check(
  "overall score uses the fixed weights",
  computeOverallScore({ clarity: 80, structure: 60, concision: 100, delivery: 40 }),
  Math.round(80 * 0.3 + 60 * 0.25 + 100 * 0.25 + 40 * 0.2),
);
check(
  "identical scores round-trip",
  computeOverallScore({ clarity: 82, structure: 82, concision: 82, delivery: 82 }),
  82,
);

// Defensive clamping.
check("clamps above 100", clampScore(140), 100);
check("clamps below 0", clampScore(-5), 0);
check("clamps NaN to 0", clampScore(Number.NaN), 0);
check("clamps garbage strings to 0", clampScore("abc"), 0);

// Usability gate.
check("rejects a too-thin transcript", isTranscriptUsable("um yeah"), false);
check(
  "accepts a real answer",
  isTranscriptUsable("I changed my mind about this after watching a colleague prepare."),
  true,
);

// End-to-end metrics shape.
const metrics = computeMetrics(
  "Basically, I used to think you know it was innate, but actually it is practice.",
  30,
);
check("metrics: word count", metrics.wordCount, 15);
check("metrics: duration rounds", metrics.durationSeconds, 30);
check("metrics: wpm", metrics.wordsPerMinute, 30);
check("metrics: filler total", metrics.fillerWordCount, 3);
check("metrics: filler rate per 100 words", metrics.fillerRate, 20);
// "used to think" is not hedging, so this transcript has none.
check("metrics: hedge count", metrics.hedgeCount, 0);
check(
  "metrics: lexical diversity is a share",
  metrics.lexicalDiversity > 0 && metrics.lexicalDiversity <= 1,
  true,
);
check("metrics: repetition rate present", typeof metrics.repetitionRate, "number");

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
