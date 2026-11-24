import { nextSeat } from './cards';
import { createRng } from './rng';
import { scoreRound, startRound } from './round';
import {
  applySignalPenalties,
  createSignalState,
  DEFAULT_AGREEMENT,
  resetForRound,
} from './signals';
import type { Agreement, GameState, Pair, Rules, Seat } from './types';

export const DEFAULT_RULES: Rules = {
  variant: 'rotterdams',
  trumpMode: 'verplicht',
  length: { kind: 'spellen', count: 16 },
  signals: { enabled: true, penalty: 'punten' },
};

/** Elk spel krijgt een eigen afgeleide seed, zodat de state serialiseerbaar blijft. */
function roundSeed(seed: number, roundIndex: number): number {
  return (seed ^ Math.imul(roundIndex + 1, 0x9e3779b1)) >>> 0;
}

/** Standaard deelt rechts (3), zodat jij (0) als eerste troef kiest en uitkomt. */
export function createGame(
  rules: Rules,
  seed: number,
  firstDealer: Seat = 3,
  agreement: Agreement = DEFAULT_AGREEMENT,
): GameState {
  return {
    rules,
    seed,
    roundIndex: 0,
    scores: [],
    round: startRound(firstDealer, rules, createRng(roundSeed(seed, 0))),
    signals: createSignalState(agreement, createRng(seed ^ 0xa9)),
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

/** Jullie variant: bieden, Amsterdams, wie het eerst 150 (afgeronde) punten heeft. */
export const BIDDING_RULES: Rules = {
  variant: 'amsterdams',
  trumpMode: 'bieden',
  length: { kind: 'punten', target: 150 },
  signals: { enabled: true, penalty: 'punten' },
};

/** Afronden op tientallen: 5 naar beneden, 6 naar boven (132 wordt 13, 76 wordt 8). */
export function roundTens(points: number): number {
  return Math.floor((points + 4) / 10);
}

/** Telt het afgelopen spel (inclusief seinstraffen) en deelt het volgende. */
export function finishRound(game: GameState): GameState {
  const { round } = game;
  if (round.phase !== 'klaar') throw new Error('Spel is nog niet klaar');
  const roundIndex = game.roundIndex + 1;
  if (round.playingTeam === null) {
    // Ingepast (niemand bood): de volgende deler deelt opnieuw, zonder telling.
    return {
      ...game,
      roundIndex,
      signals: resetForRound(game.signals),
      round: startRound(
        nextSeat(round.dealer),
        game.rules,
        createRng(roundSeed(game.seed, roundIndex)),
      ),
    };
  }
  let score = applySignalPenalties(
    scoreRound(round.tricks, round.playingTeam, round.contract),
    game.signals,
  );
  if (game.rules.trumpMode === 'bieden')
    score = { ...score, total: [roundTens(score.total[0]), roundTens(score.total[1])] };
  const next: GameState = {
    ...game,
    roundIndex,
    scores: [...game.scores, score],
    signals: resetForRound(game.signals),
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
