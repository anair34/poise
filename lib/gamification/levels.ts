/**
 * XP thresholds and level arithmetic.
 *
 * Level is *derived*, never stored. Storing it would create a second source of
 * truth that can disagree with `totalXp` — and the disagreement would be
 * invisible until a user saw two different levels on two screens. Deriving
 * costs a handful of comparisons and can never drift.
 *
 * Everything here is pure so the whole curve is testable without Firestore.
 */

/**
 * Cumulative XP required to *reach* each level. Index 0 is level 1.
 *
 * The gaps widen deliberately (50, 70, 80, 100, 125, 150…): early levels should
 * arrive within the first few sessions so a new user sees the system respond,
 * while later ones should take a habit rather than an afternoon.
 */
export const LEVEL_THRESHOLDS = [
  0, 50, 120, 200, 300, 425, 575, 750, 950, 1175, 1425, 1700, 2000, 2325, 2675,
] as const;

/** Added per level once the table runs out, so the curve never ends. */
const OVERFLOW_STEP = 400;

export const MAX_TABLE_LEVEL = LEVEL_THRESHOLDS.length;

function safeXp(xp: number): number {
  return Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
}

/** Cumulative XP needed to reach a given level. Level 1 is always 0. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= MAX_TABLE_LEVEL) return LEVEL_THRESHOLDS[level - 1];
  const beyond = level - MAX_TABLE_LEVEL;
  return LEVEL_THRESHOLDS[MAX_TABLE_LEVEL - 1] + beyond * OVERFLOW_STEP;
}

export function getLevelFromXp(xp: number): number {
  const total = safeXp(xp);

  let level = 1;
  while (level < MAX_TABLE_LEVEL && total >= LEVEL_THRESHOLDS[level]) {
    level += 1;
  }

  if (level === MAX_TABLE_LEVEL) {
    const top = LEVEL_THRESHOLDS[MAX_TABLE_LEVEL - 1];
    if (total >= top) {
      level = MAX_TABLE_LEVEL + Math.floor((total - top) / OVERFLOW_STEP);
    }
  }

  return level;
}

/** Total XP at which the next level begins. */
export function getXpForNextLevel(xp: number): number {
  return xpForLevel(getLevelFromXp(xp) + 1);
}

export interface LevelProgress {
  level: number;
  /** Total XP the user has. */
  totalXp: number;
  /** XP earned since this level began. */
  xpIntoLevel: number;
  /** XP this level spans, i.e. how much is needed to finish it. */
  xpForLevel: number;
  /** Total XP at which the next level starts. */
  nextLevelXp: number;
  /** 0–1, for a progress bar. */
  progress: number;
}

export function getLevelProgress(xp: number): LevelProgress {
  const totalXp = safeXp(xp);
  const level = getLevelFromXp(totalXp);
  const floor = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - floor);
  const xpIntoLevel = totalXp - floor;

  return {
    level,
    totalXp,
    xpIntoLevel,
    xpForLevel: span,
    nextLevelXp,
    progress: Math.min(1, Math.max(0, xpIntoLevel / span)),
  };
}

/** True when awarding `gained` XP moved the user across a level boundary. */
export function didLevelUp(previousXp: number, gained: number): boolean {
  if (gained <= 0) return false;
  return getLevelFromXp(previousXp + gained) > getLevelFromXp(previousXp);
}
