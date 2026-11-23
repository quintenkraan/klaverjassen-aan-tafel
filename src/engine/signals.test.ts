import { describe, expect, it } from 'vitest';
import { PERSONALITIES } from './ai/profile';
import { chooseCard, smartBotStep } from './ai/smart';
import { createGame, DEFAULT_RULES, finishRound, isGameOver } from './game';
import { createRng } from './rng';
import {
  accuse,
  botSignalIntent,
  createSignalState,
  DEFAULT_AGREEMENT,
  FALSE_ACCUSATION_POINTS,
  PENALTY_POINTS,
  resetForRound,
  sendSignal,
} from './signals';
import { c, cs } from './testUtils';
import type { RoundState, Rules, Seat, SignalState } from './types';

const round = (partial: Partial<RoundState> = {}): RoundState => ({
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
});

const blind = () => 0;
const sharp = () => 1;
const fresh = (seed = 1) => createSignalState(DEFAULT_AGREEMENT, createRng(seed));

describe('seinen versturen', () => {
  it('tegenstanders hebben een volledige eigen afspraak', () => {
    const meanings = Object.values(fresh().opponentAgreement).filter(Boolean);
    expect(new Set(meanings).size).toBe(5);
  });

  it('oplettende maat ziet en begrijpt een duidelijk sein meestal', () => {
    const rng = createRng(4);
    let understood = 0;
    for (let i = 0; i < 400; i++) {
      // Henk (2) is de ontvanger als de mens (0) seint; tegenstanders kijken niet.
      const att = (s: Seat) => (s === 2 ? 1 : 0);
      const { event } = sendSignal(fresh(), round(), DEFAULT_RULES, 0, 'tikken', rng, att);
      if (event.understood === 'speel-klaveren') understood++;
    }
    expect(understood / 400).toBeGreaterThan(0.55);
    expect(understood / 400).toBeLessThan(0.75);
  });

  it('niet opgelet: niets gezien, geen overtuiging', () => {
    const { state, event } = sendSignal(
      fresh(),
      round(),
      DEFAULT_RULES,
      0,
      'oorkrabben',
      createRng(1),
      blind,
    );
    expect(event.seen).toBe(false);
    expect(state.beliefs[2]).toBeNull();
  });

  it('mens als ontvanger moet zelf opletten', () => {
    const { event } = sendSignal(
      fresh(),
      round(),
      DEFAULT_RULES,
      2,
      'knipoog',
      createRng(1),
      sharp,
    );
    expect(event.seen).toBeNull();
    expect(event.to).toBe(0);
  });

  it('achterdocht groeit per sein en maakt betrappen waarschijnlijker', () => {
    const rate = (suspicion: number) => {
      const rng = createRng(9);
      let caught = 0;
      for (let i = 0; i < 400; i++) {
        const s: SignalState = { ...fresh(), suspicion };
        if (sendSignal(s, round(), DEFAULT_RULES, 0, 'knipoog', rng, sharp).event.caughtBy !== null)
          caught++;
      }
      return caught / 400;
    };
    expect(rate(0.9)).toBeGreaterThan(rate(0) + 0.1);
    const after = sendSignal(
      fresh(),
      round(),
      DEFAULT_RULES,
      0,
      'knipoog',
      createRng(1),
      blind,
    ).state;
    expect(after.suspicion).toBeGreaterThan(0);
    expect(resetForRound({ ...after, suspicion: 0.8 }).suspicion).toBeCloseTo(0.4);
  });
});

describe('betrapt worden', () => {
  // Rng die altijd 0 geeft: alles wordt gezien en betrapt.
  const always = () => 0;

  it('eerst waarschuwing, daarna strafpunten, en tegenstanders leren het gebaar', () => {
    let s = fresh();
    const first = sendSignal(s, round(), DEFAULT_RULES, 0, 'knipoog', always, sharp);
    expect(first.event.consequence).toBe('waarschuwing');
    s = first.state;
    expect(s.known).toContain('knipoog');
    const second = sendSignal(s, round(), DEFAULT_RULES, 0, 'knipoog', always, sharp);
    expect(second.event.consequence).toBe('strafpunten');
    expect(second.state.penalties).toEqual([0, PENALTY_POINTS]);
  });

  it('straf "spel": spel verbeurd en zo geteld', () => {
    const rules: Rules = { ...DEFAULT_RULES, signals: { enabled: true, penalty: 'spel' } };
    let s: SignalState = { ...fresh(), warned: [true, false] };
    s = sendSignal(s, round(), rules, 0, 'tikken', always, sharp).state;
    expect(s.forfeit).toBe(0);

    let game = { ...createGame(rules, 1), signals: s };
    // Speel het spel uit met slimme bots op alle stoelen.
    const rng = createRng(2);
    let r = game.round;
    while (r.phase !== 'klaar') {
      const seat = r.turn === 0 ? 2 : r.turn;
      r = smartBotStep(r, rules, rng, {
        personality: PERSONALITIES[seat as 1 | 2 | 3],
        difficulty: 'sterk',
      });
    }
    game = finishRound({ ...game, round: r });
    const score = game.scores[0]!;
    expect(score.forfeit).toBe(0);
    expect(score.total[0]).toBe(0);
    expect(score.total[1]).toBe(162 + score.roem[0] + score.roem[1]);
    expect(game.signals.forfeit).toBeNull();
  });
});

describe('Ik zag dat!', () => {
  it('terecht: tegenpartij krijgt een waarschuwing', () => {
    const r = round({ currentTrick: { leader: 0, cards: [{ seat: 0, card: c('k7') }] } });
    const sent = sendSignal(fresh(), r, DEFAULT_RULES, 1, 'knipoog', createRng(3), blind);
    const res = accuse(sent.state, r, DEFAULT_RULES, 0);
    expect(res).toMatchObject({ correct: true, consequence: 'waarschuwing', accused: 1 });
    expect(res.state.warned).toEqual([false, true]);
  });

  it('te laat of onterecht: strafpunten voor de tegenpartij', () => {
    const early = round();
    const sent = sendSignal(fresh(), early, DEFAULT_RULES, 1, 'knipoog', createRng(3), blind);
    const later = round({ tricks: [{ leader: 0, cards: [], winner: 0, points: 0, roem: 0 }] });
    const res = accuse(sent.state, later, DEFAULT_RULES, 0);
    expect(res.correct).toBe(false);
    expect(res.state.penalties).toEqual([0, FALSE_ACCUSATION_POINTS]);
  });
});

describe('bots en seinen', () => {
  it('bot met troefboer seint "troefboer" volgens de afspraak', () => {
    const r = round({ hands: [[], [], cs('hB', 'k7'), []] });
    const always = () => 0;
    expect(botSignalIntent(r, 2, PERSONALITIES[2], fresh(), always)).toBe('knipoog');
  });

  it('bot seint hooguit één keer per spel', () => {
    const r = round({ hands: [[], [], cs('hB'), []] });
    const s = sendSignal(fresh(), r, DEFAULT_RULES, 2, 'knipoog', createRng(1), blind).state;
    expect(botSignalIntent(r, 2, PERSONALITIES[2], s, () => 0)).toBeNull();
  });

  it('bot komt uit in de geseinde kleur', () => {
    const r = round({ turn: 2, hands: [[], [], cs('r7', 'kA', 'k8', 's9'), []] });
    const p = { personality: PERSONALITIES[2], difficulty: 'sterk' as const };
    expect(chooseCard(r, DEFAULT_RULES, createRng(1), p, 'speel-ruiten')).toEqual(c('r7'));
    expect(chooseCard(r, DEFAULT_RULES, createRng(1), p, null)).toEqual(c('kA'));
  });

  it('volledig potje met seinende bots blijft legaal', () => {
    const rules = DEFAULT_RULES;
    const rng = createRng(5);
    const att = (s: Seat) => (s === 0 ? 0 : PERSONALITIES[s as 1 | 2 | 3].attention);
    let game = createGame(rules, 77);
    let signals = 0;
    while (!isGameOver(game)) {
      let { round: r, signals: s } = game;
      while (r.phase !== 'klaar') {
        const seat = (r.turn === 0 ? 2 : r.turn) as 1 | 2 | 3;
        const g = r.turn !== 0 ? botSignalIntent(r, seat, PERSONALITIES[seat], s, rng) : null;
        if (g) {
          s = sendSignal(s, r, rules, r.turn, g, rng, att).state;
          signals++;
        }
        r = smartBotStep(
          r,
          rules,
          rng,
          { personality: PERSONALITIES[seat], difficulty: 'gemiddeld' },
          s.beliefs[r.turn] ?? null,
        );
      }
      game = finishRound({ ...game, round: r, signals: s });
    }
    expect(game.scores).toHaveLength(16);
    expect(signals).toBeGreaterThan(0);
  });
});
