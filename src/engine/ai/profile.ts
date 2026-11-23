import type { Seat } from '../types';

export type Difficulty = 'makkelijk' | 'gemiddeld' | 'sterk';

/** Alle waarden 0..1. attention, signalTendency en honesty worden gebruikt in F6 (seinen). */
export interface Personality {
  /** Hoe snel hij troef kiest en risico neemt om een slag te winnen. */
  aggression: number;
  /** Hoe goed hij gespeelde kaarten onthoudt. */
  memory: number;
  /** Hoe goed hij seinen opmerkt. */
  attention: number;
  /** Hoe vaak hij zelf seint. */
  signalTendency: number;
  /** Hoe eerlijk hij speelt (minder seinen, sneller "ik zag dat!"). */
  honesty: number;
}

export interface BotProfile {
  personality: Personality;
  difficulty: Difficulty;
}

export const PERSONALITIES: Record<Exclude<Seat, 0>, Personality> = {
  // Tante Ria: voorzichtig, oplettend, telt goed.
  1: { aggression: 0.35, memory: 0.9, attention: 0.85, signalTendency: 0.25, honesty: 0.75 },
  // Ome Henk (jouw maat): degelijk, seint graag.
  2: { aggression: 0.55, memory: 0.85, attention: 0.6, signalTendency: 0.65, honesty: 0.45 },
  // Sjaak: gokker, vergeetachtig.
  3: { aggression: 0.85, memory: 0.65, attention: 0.5, signalTendency: 0.5, honesty: 0.35 },
};

export const DIFFICULTY: Record<Difficulty, { mistake: number; memoryFactor: number }> = {
  makkelijk: { mistake: 0.3, memoryFactor: 0.5 },
  gemiddeld: { mistake: 0.07, memoryFactor: 0.9 },
  sterk: { mistake: 0, memoryFactor: 1 },
};

export function effectiveMemory(profile: BotProfile): number {
  if (profile.difficulty === 'sterk') return 1;
  return profile.personality.memory * DIFFICULTY[profile.difficulty].memoryFactor;
}

export function profileFor(seat: Exclude<Seat, 0>, difficulty: Difficulty): BotProfile {
  return { personality: PERSONALITIES[seat], difficulty };
}
