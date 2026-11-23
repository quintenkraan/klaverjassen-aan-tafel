import { describe, expect, it } from 'vitest';
import { createGame, DEFAULT_RULES, finishRound, isGameOver, totals } from '../game';
import { createRng } from '../rng';
import { bidOptions } from '../round';
import { c, cs } from '../testUtils';
import type { GameState, RoundState, Rules, Seat } from '../types';
import { PERSONALITIES, type BotProfile, type Difficulty } from './profile';
import { simpleBotStep } from './simple';
import { chooseCard, handStrength, smartBotStep } from './smart';

const strong: BotProfile = { personality: PERSONALITIES[2], difficulty: 'sterk' };

function playing(partial: Partial<RoundState>): RoundState {
  return {
    dealer: 3,
    hands: [[], [], [], []],
    phase: 'spelen',
    turn: 0,
    trump: 'harten',
    trumpChooser: 0,
    playingTeam: 0,
    proposedSuit: null,
    passes: 0,
    currentTrick: { leader: 0, cards: [] },
    tricks: [],
    ...partial,
  };
}

describe('handStrength en troefkeuze', () => {
  it('sterke troefhand scoort hoger dan zwakke', () => {
    const hand = cs('hB', 'h9', 'hA', 'kA', 'r7', 'r8', 's7', 's8');
    expect(handStrength(hand, 'harten')).toBeGreaterThan(10);
    expect(handStrength(hand, 'harten')).toBeGreaterThan(handStrength(hand, 'ruiten') + 5);
  });

  it('vrij: zwakke hand past, sterke hand kiest', () => {
    const R: Rules = { ...DEFAULT_RULES, trumpMode: 'vrij' };
    const weak = cs('k7', 'k8', 'r7', 'r9', 'hV', 's7', 's8', 'h8');
    const good = cs('hB', 'h9', 'hA', 'h10', 'kA', 'r7', 's7', 's8');
    const base = playing({ phase: 'bieden', turn: 1, trump: null, playingTeam: null });
    const rng = createRng(1);
    const p: BotProfile = { personality: PERSONALITIES[1], difficulty: 'sterk' };
    expect(smartBotStep({ ...base, hands: [[], weak, [], []] }, R, rng, p).passes).toBe(1);
    const chosen = smartBotStep({ ...base, hands: [[], good, [], []] }, R, rng, p);
    expect(chosen.trump).toBe('harten');
    expect(bidOptions(chosen, R).suits).toEqual([]);
  });
});

describe('kaartkeuze', () => {
  const rng = createRng(3);

  it('spelende partij trekt troef met de troefboer', () => {
    const r = playing({ hands: [cs('hB', 'h7', 'kA', 'r8'), [], [], []] });
    expect(chooseCard(r, DEFAULT_RULES, rng, strong)).toEqual(c('hB'));
  });

  it('maat heeft een veilige slag: punten bijgooien', () => {
    // Seat 2 aan de beurt, maat (0) ligt met de klaveren aas, 1 heeft klaveren bekend.
    const r = playing({
      turn: 2,
      hands: [[], [], cs('k10', 'k7', 'r8'), []],
      currentTrick: {
        leader: 0,
        cards: [
          { seat: 0, card: c('kA') },
          { seat: 1, card: c('k8') },
        ],
      },
      tricks: [],
    });
    expect(chooseCard(r, DEFAULT_RULES, rng, strong)).toEqual(c('k10'));
  });

  it('als laatste: winnen met de kaart die de meeste punten oplevert', () => {
    const r = playing({
      turn: 3,
      hands: [[], [], [], cs('kA', 'k10', 'k7')],
      currentTrick: {
        leader: 0,
        cards: [
          { seat: 0, card: c('kV') },
          { seat: 1, card: c('k8') },
          { seat: 2, card: c('kH') },
        ],
      },
    });
    expect(chooseCard(r, DEFAULT_RULES, rng, strong)).toEqual(c('kA'));
  });

  it('kan niet winnen: laagste kaart weggooien', () => {
    const r = playing({
      turn: 1,
      hands: [[], cs('k7', 'k10', 'kV'), [], []],
      currentTrick: { leader: 0, cards: [{ seat: 0, card: c('hB') }] },
    });
    // Troef gevraagd, geen troef: bijkleur, goedkoopste kaart.
    expect(chooseCard(r, DEFAULT_RULES, rng, strong)).toEqual(c('k7'));
  });
});

function playMatch(
  rules: Rules,
  seed: number,
  team0: Difficulty | 'random',
  team1: Difficulty | 'random',
): GameState {
  const rng = createRng(seed ^ 99);
  let game = createGame(rules, seed);
  while (!isGameOver(game)) {
    let r = game.round;
    while (r.phase !== 'klaar') {
      const seat = r.turn as Seat;
      const level = seat % 2 === 0 ? team0 : team1;
      r =
        level === 'random'
          ? simpleBotStep(r, rules, rng)
          : smartBotStep(r, rules, rng, {
              personality: PERSONALITIES[seat === 0 ? 2 : (seat as 1 | 2 | 3)],
              difficulty: level,
            });
    }
    game = finishRound({ ...game, round: r });
  }
  return game;
}

describe('volledige potjes', () => {
  for (const trumpMode of ['verplicht', 'vrij', 'utrechts'] as const) {
    for (const variant of ['amsterdams', 'rotterdams'] as const) {
      it(`slimme bots spelen altijd legaal (${trumpMode}, ${variant})`, () => {
        const R: Rules = { ...DEFAULT_RULES, trumpMode, variant };
        for (const d of ['makkelijk', 'gemiddeld', 'sterk'] as const) {
          const g = playMatch(R, 5, d, d);
          expect(g.scores).toHaveLength(16);
        }
      });
    }
  }

  it('sterke bots verslaan willekeurige bots ruim', () => {
    let us = 0;
    let them = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const [a, b] = totals(playMatch(DEFAULT_RULES, seed, 'sterk', 'random'));
      us += a;
      them += b;
    }
    expect(us).toBeGreaterThan(them * 1.5);
  });

  it('sterk wint van makkelijk', () => {
    let us = 0;
    let them = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const [a, b] = totals(playMatch(DEFAULT_RULES, seed, 'sterk', 'makkelijk'));
      us += a;
      them += b;
    }
    expect(us).toBeGreaterThan(them);
  });
});
