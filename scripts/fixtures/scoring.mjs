/**
 * Deterministic scoring fixtures.
 *
 * Each fixture is a transcript, a duration, and the scores a model would
 * plausibly return for it *before* constraints. The raw scores are deliberately
 * generous across the board — that is the failure mode being defended against,
 * and a fixture that pre-penalises itself would prove nothing.
 *
 * Word counts are calibrated so each transcript is plausible at its stated
 * duration (roughly 130-150 words per minute unless the fixture is specifically
 * testing an unusual pace). An underwritten transcript would land in the wrong
 * pace band and test something other than what it claims to.
 *
 * Shared by `check-scoring-v2.mjs` and `audit-scoring.mjs`.
 */

/** A generous, undifferentiated set of raw scores. */
const OPTIMISTIC = {
  clarity: 82,
  structure: 78,
  concision: 85,
  delivery: 80,
};

/** ~133 words: a natural 55 seconds at about 145 wpm. */
const COMPLETE_ANSWER =
  "I used to think that speaking well was something you were simply born with. " +
  "You either had presence in a room or you did not, and no amount of effort was going to change that. " +
  "What changed my mind was watching a colleague prepare for a quarterly review last spring. " +
  "She was not naturally fluent at all, and she practised out loud every single morning for about three weeks. " +
  "She recorded herself on her phone and listened back on the walk to the office. " +
  "By the time she actually presented, everyone in the room assumed she was simply a natural speaker. " +
  "That taught me the confidence I had been quietly envying was really just repetition that I had never seen happen. " +
  "Now when someone seems effortless, I assume there is practice behind it that I did not watch.";

/** ~145 words: a full 60 seconds, well organised. */
const EXCELLENT_ANSWER =
  "The best decision I made last year was to stop optimising for being right in meetings. " +
  "For a long time I treated every discussion as something to win, and I prepared accordingly. " +
  "I would arrive with my argument built and my counterarguments ready before anyone had spoken. " +
  "The change came after a project review where I argued a point extremely well and watched the whole team quietly disengage. " +
  "I had won the argument and lost the room, and the work suffered badly for it over the following month. " +
  "Nobody told me directly, which made it worse, because I had to work out what had happened myself. " +
  "Now I open by stating what I am uncertain about, which invites people in rather than pushing them out. " +
  "The decisions we reach take a little longer to make, and they survive contact with reality far better.";

export const FIXTURES = [
  {
    id: "6s-fragment",
    label: "6-second response",
    durationSeconds: 6,
    // ~14 words: a single unfinished thought.
    transcript:
      "I think probably the main thing is that it completely changed my mind about it.",
    rawScores: OPTIMISTIC,
  },
  {
    id: "10s-fragment",
    label: "10-second response",
    durationSeconds: 10,
    // ~23 words.
    transcript:
      "I used to think that speaking well was something you were simply born with, " +
      "and I really do not think that any more at all.",
    rawScores: OPTIMISTIC,
  },
  {
    id: "18s-incomplete",
    label: "18-second response",
    durationSeconds: 18,
    // ~41 words.
    transcript:
      "I used to think that speaking well was something you were simply born with. " +
      "Watching a colleague prepare for a big quarterly review changed my mind about that completely, " +
      "because she practised out loud every single morning for weeks.",
    rawScores: OPTIMISTIC,
  },
  {
    id: "30s-partial",
    label: "30-second response",
    durationSeconds: 30,
    // ~66 words: a real start that stops before it lands.
    transcript:
      "I used to think that speaking well was something you were simply born with. " +
      "You either had presence in a room or you did not, and effort was not going to change it. " +
      "What changed my mind was watching a colleague prepare for a quarterly review last spring. " +
      "She practised out loud every single morning until the shape of her thinking got clearer.",
    rawScores: OPTIMISTIC,
  },
  {
    id: "55s-normal",
    label: "55-second normal response",
    durationSeconds: 55,
    transcript: COMPLETE_ANSWER,
    rawScores: OPTIMISTIC,
  },
  {
    id: "60s-excellent",
    label: "60-second excellent response",
    durationSeconds: 60,
    transcript: EXCELLENT_ANSWER,
    rawScores: { clarity: 94, structure: 92, concision: 90, delivery: 91 },
  },
  {
    id: "60s-filler-heavy",
    label: "60-second filler-heavy response",
    durationSeconds: 60,
    // ~140 words, saturated with hesitations and verbal tics.
    transcript:
      "So um, I basically used to think, you know, that speaking well was um sort of something you were just born with. " +
      "And uh, I mean, basically you either had presence in the room or you kind of did not, you know. " +
      "Um, what actually changed my mind was uh watching a colleague, you know, prepare for this big quarterly review thing. " +
      "She um basically practised out loud, I mean, every single morning, sort of, for about three weeks or so. " +
      "And uh she literally recorded herself, you know, on her phone, and um listened back, basically, on the walk in. " +
      "And uh by the time she actually presented, everyone basically thought she was, you know, just a natural at it.",
    rawScores: OPTIMISTIC,
  },
  {
    id: "60s-repetitive",
    label: "60-second highly repetitive response",
    durationSeconds: 60,
    // ~140 words, circling the same few phrases.
    transcript:
      "I changed my mind about it. I changed my mind about it because of my colleague at work. " +
      "My colleague practised out loud. My colleague practised out loud every single morning before work. " +
      "I changed my mind about it when I saw that happen. I changed my mind about it completely. " +
      "My colleague practised out loud and that is really what changed my mind about it. " +
      "So I changed my mind about it, and my colleague practised out loud every single morning. " +
      "I changed my mind about it because my colleague practised out loud every single morning before work. " +
      "That is what changed my mind about it, watching my colleague practise out loud every single morning.",
    rawScores: OPTIMISTIC,
  },
  {
    id: "60s-very-fast",
    label: "extremely fast response",
    // The full 133-word answer crammed into 30 seconds: roughly 266 wpm.
    durationSeconds: 30,
    transcript: COMPLETE_ANSWER,
    rawScores: OPTIMISTIC,
  },
  {
    id: "35s-concise-complete",
    label: "concise but complete 35-second response",
    durationSeconds: 35,
    // ~89 words at about 152 wpm: a finished argument, efficiently made.
    transcript:
      "I used to think presence was something you were simply born with, and I was wrong about that. " +
      "Watching a colleague prepare for a quarterly review changed it for me completely. " +
      "She was not naturally fluent, so she practised out loud every morning for about three weeks. " +
      "She recorded herself and listened back on the walk into the office. " +
      "By the presentation, everyone in the room assumed she was simply a natural speaker. " +
      "What I had been calling raw talent was really just repetition that I had never seen.",
    rawScores: OPTIMISTIC,
  },
  {
    id: "60s-long-structured",
    label: "long but structured response",
    durationSeconds: 60,
    // ~175 words at about 175 wpm: brisk, but genuinely well organised.
    transcript:
      `${EXCELLENT_ANSWER} ` +
      "The clearest sign it worked was that people started bringing me problems earlier, " +
      "while they were still messy enough to be worth talking about at all.",
    rawScores: { clarity: 88, structure: 90, concision: 74, delivery: 85 },
  },
  {
    id: "12s-clear-incomplete",
    label: "short but clear incomplete response",
    durationSeconds: 12,
    // ~26 words: sharp, completely understandable, and not an answer.
    transcript:
      "Presence is not something you are born with at all. " +
      "It is really just repetition that other people never happen to see.",
    // A model would reasonably rate this highly on clarity: it is a sharp,
    // perfectly understandable sentence. It is still not an answer.
    rawScores: { clarity: 90, structure: 70, concision: 92, delivery: 82 },
  },
];

export function fixtureById(id) {
  return FIXTURES.find((fixture) => fixture.id === id);
}
