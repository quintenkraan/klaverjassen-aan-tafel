import { nextSeat } from './cards';
import { createRng } from './rng';
import { scoreRound, startRound } from './round';
import type { GameState, Pair, Rules, Seat } from './types';

export const DEFAULT_RULES: Rules = {
  variant: 'rotterdams',
  trumpMode: 'verplicht',
  length: { kind: 'spellen', count: 16 },
};

/** Elk spel krijgt een eigen afgeleide seed, zodat de state serialiseerbaar blijft. */
function roundSeed(seed: number, roundIndex: number): number {
  return (seed ^ Math.imul(roundIndex + 1, 0x9e3779b1)) >>> 0;
}

/** Standaard deelt rechts (3), zodat jij (0) als eerste troef kiest en uitkomt. */
export function createGame(rules: Rules, seed: number, firstDealer: Seat = 3): GameState {
  return {
    rules,
    seed,
    roundIndex: 0,
    scores: [],
    round: startRound(firstDealer, rules, createRng(roundSeed(seed, 0))),
  };
}

export function totals(game: GameState): Pair {
  return game.scores.reduce<Pair>((acc, s) => [acc[0] + s.total[0], acc[1] + s.total[1]], [0, 0]);
}

export function isGameOver(game: GameState): boolean {
  const { length } = game.rules;
  if (length.kind === 'spellen') return game.scores.length >= length.count;
  return Math.max(...totals(game)) >= length.target;
}

/** Telt het afgelopen spel en deelt het volgende (tenzij het potje voorbij is). */
export function finishRound(game: GameState): GameState {
  const { round } = game;
  if (round.phase !== 'klaar' || round.playingTeam === null)
    throw new Error('Spel is nog niet klaar');
  const roundIndex = game.roundIndex + 1;
  const next: GameState = {
    ...game,
    roundIndex,
    scores: [...game.scores, scoreRound(round.tricks, round.playingTeam)],
  };
  if (isGameOver(next)) return next;
  return {
    ...next,
    round: startRound(
      nextSeat(round.dealer),
      game.rules,
      createRng(roundSeed(game.seed, roundIndex)),
    ),
  };
}
