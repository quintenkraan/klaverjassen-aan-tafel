import { describe, expect, it } from 'vitest';
import { cardId } from './cards';
import { createGame, DEFAULT_RULES, finishRound, isGameOver, totals } from './game';
import { createRng } from './rng';
import {
  bidOptions,
  chooseTrump,
  deal,
  passBid,
  playableCards,
  playCard,
  scoreRound,
  startRound,
} from './round';
import { c, done } from './testUtils';
import type { GameState, RoundState, Rules, TrumpMode, Variant } from './types';

const rules = (trumpMode: TrumpMode, variant: Variant = 'rotterdams'): Rules => ({
  ...DEFAULT_RULES,
  trumpMode,
  variant,
});

describe('delen', () => {
  it('8 kaarten per speler, alle 32 uniek, reproduceerbaar', () => {
    const hands = deal(0, createRng(5));
    expect(hands.map((h) => h.length)).toEqual([8, 8, 8, 8]);
    expect(new Set(hands.flat().map(cardId)).size).toBe(32);
    expect(deal(0, createRng(5))).toEqual(hands);
  });
});

describe('troef bepalen', () => {
  it('verplicht: speler na de deler kiest, passen mag niet', () => {
    const r = startRound(3, rules('verplicht'), createRng(1));
    expect(r.turn).toBe(0);
    expect(bidOptions(r, rules('verplicht')).canPass).toBe(false);
    const s = chooseTrump(r, rules('verplicht'), 0, 'ruiten');
    expect(s).toMatchObject({ phase: 'spelen', trump: 'ruiten', playingTeam: 0, turn: 0 });
  });

  it('vrij: na vier keer passen moet de eerste kiezen', () => {
    const R = rules('vrij');
    let r = startRound(3, R, createRng(1));
    for (const seat of [0, 1, 2, 3] as const) r = passBid(r, R, seat);
    expect(r.turn).toBe(0);
    expect(bidOptions(r, R).canPass).toBe(false);
  });

  it('utrechts: alleen de voorgestelde kleur, na rondje passen een andere', () => {
    const R = rules('utrechts');
    let r = startRound(0, R, createRng(2));
    const proposed = r.proposedSuit!;
    expect(bidOptions(r, R).suits).toEqual([proposed]);
    r = passBid(r, R, 1);
    const s = chooseTrump(r, R, 2, proposed);
    expect(s.playingTeam).toBe(0);
    expect(s.turn).toBe(1); // speler na de deler komt uit, niet de kiezer

    let p = startRound(0, R, createRng(2));
    for (const seat of [1, 2, 3, 0] as const) p = passBid(p, R, seat);
    expect(bidOptions(p, R).suits).not.toContain(proposed);
    expect(bidOptions(p, R).suits).toHaveLength(3);
  });

  it('niet aan de beurt geeft een fout', () => {
    const r = startRound(3, rules('verplicht'), createRng(1));
    expect(() => chooseTrump(r, rules('verplicht'), 2, 'harten')).toThrow();
  });
});

describe('spelen', () => {
  it('roem en +10 in de laatste slag', () => {
    const state: RoundState = {
      dealer: 3,
      hands: [[c('k7')], [c('k8')], [c('k9')], [c('rA')]],
      phase: 'spelen',
      turn: 0,
      trump: 'schoppen',
      trumpChooser: 0,
      playingTeam: 0,
      proposedSuit: null,
      passes: 0,
      currentTrick: { leader: 0, cards: [] },
      tricks: Array.from({ length: 7 }, () => done(0, 0)),
    };
    const R = DEFAULT_RULES;
    let s = playCard(state, R, 0, c('k7'));
    s = playCard(s, R, 1, c('k8'));
    s = playCard(s, R, 2, c('k9'));
    s = playCard(s, R, 3, c('rA'));
    expect(s.phase).toBe('klaar');
    expect(s.tricks[7]).toMatchObject({ winner: 2, points: 21, roem: 20 });
  });

  it('illegale kaart geeft een fout', () => {
    let r = startRound(3, DEFAULT_RULES, createRng(9));
    r = chooseTrump(r, DEFAULT_RULES, 0, 'harten');
    const lead = r.hands[0]![0]!;
    r = playCard(r, DEFAULT_RULES, 0, lead);
    const hand = r.hands[1]!;
    const illegal = hand.find((h) => !playableCards(r, DEFAULT_RULES).includes(h));
    if (illegal) expect(() => playCard(r, DEFAULT_RULES, 1, illegal)).toThrow();
  });
});

describe('telling', () => {
  it('gewoon gehaald', () => {
    const s = scoreRound([done(0, 100, 20), done(1, 62)], 0);
    expect(s).toMatchObject({ nat: false, total: [120, 62] });
  });
  it('nat: tegenpartij krijgt 162 plus alle roem', () => {
    const s = scoreRound([done(0, 70, 20), done(1, 92)], 0);
    expect(s).toMatchObject({ nat: true, total: [0, 182] });
  });
  it('nat door roem van de tegenpartij', () => {
    const s = scoreRound([done(0, 90), done(1, 72, 50)], 0);
    expect(s).toMatchObject({ nat: true, total: [0, 212] });
  });
  it('precies gelijk is nat', () => {
    expect(scoreRound([done(0, 81), done(1, 81)], 0).nat).toBe(true);
  });
  it('pit: +100 bovenop roem', () => {
    const tricks = [done(0, 152 - 7 * 10, 20), ...Array.from({ length: 6 }, () => done(2, 10)), done(0, 20)];
    const s = scoreRound(tricks, 0);
    expect(s).toMatchObject({ pit: 0, nat: false, roem: [120, 0], total: [282, 0] });
  });
  it('pit door de tegenpartij', () => {
    const s = scoreRound(Array.from({ length: 8 }, () => done(1, 20)), 0);
    expect(s).toMatchObject({ pit: 1, nat: true, total: [0, 262] });
  });
});

describe('volledig potje met willekeurige legale zetten', () => {
  const modes: TrumpMode[] = ['verplicht', 'vrij', 'utrechts'];
  const variants: Variant[] = ['amsterdams', 'rotterdams'];

  for (const mode of modes) {
    for (const variant of variants) {
      it(`${mode} / ${variant}`, () => {
        const R = rules(mode, variant);
        const rng = createRng(123);
        let game: GameState = createGame(R, 42);
        while (!isGameOver(game)) {
          let r = game.round;
          while (r.phase === 'bieden') {
            const opts = bidOptions(r, R);
            r =
              opts.canPass && rng() < 0.6
                ? passBid(r, R, r.turn)
                : chooseTrump(r, R, r.turn, opts.suits[Math.floor(rng() * opts.suits.length)]!);
          }
          while (r.phase === 'spelen') {
            const options = playableCards(r, R);
            expect(options.length).toBeGreaterThan(0);
            r = playCard(r, R, r.turn, options[Math.floor(rng() * options.length)]!);
          }
          expect(r.tricks.reduce((s, t) => s + t.points, 0)).toBe(162);
          expect(r.hands.every((h) => h.length === 0)).toBe(true);
          game = finishRound({ ...game, round: r });
        }
        expect(game.scores).toHaveLength(16);
        for (const s of game.scores) {
          const roem = s.roem[0] + s.roem[1];
          expect(s.total[0] + s.total[1]).toBe(162 + roem);
        }
        expect(totals(game)[0] + totals(game)[1]).toBeGreaterThanOrEqual(16 * 162);
      });
    }
  }

  it('potje tot puntenlimiet stopt zodra de limiet gehaald is', () => {
    const R: Rules = { ...DEFAULT_RULES, length: { kind: 'punten', target: 500 } };
    const rng = createRng(7);
    let game = createGame(R, 1);
    while (!isGameOver(game)) {
      let r = chooseTrump(game.round, R, game.round.turn, 'harten');
      while (r.phase === 'spelen') {
        const o = playableCards(r, R);
        r = playCard(r, R, r.turn, o[Math.floor(rng() * o.length)]!);
      }
      game = finishRound({ ...game, round: r });
    }
    expect(Math.max(...totals(game))).toBeGreaterThanOrEqual(500);
  });
});
