import { describe, expect, it } from 'vitest';
import { PERSONALITIES } from './ai/profile';
import { smartBotStep } from './ai/smart';
import { BIDDING_RULES, createGame, DEFAULT_RULES, finishRound, totals } from './game';
import { createRng } from './rng';
import { chooseTrump, placeBid, playableCards } from './round';
import { sendSignal } from './signals';
import type { GameState, Seat } from './types';
import { fromView, HIDDEN_CARD, toView, viewFor } from './view';

function playedGame(): GameState {
  const rules = DEFAULT_RULES;
  const rng = createRng(4);
  let game = createGame(rules, 9);
  let r = chooseTrump(game.round, rules, 0, 'harten');
  for (let i = 0; i < 5; i++) {
    const seat = r.turn;
    r = smartBotStep(r, rules, rng, {
      personality: PERSONALITIES[seat === 0 ? 2 : (seat as 1 | 2 | 3)],
      difficulty: 'sterk',
    });
  }
  game = { ...game, round: r };
  return game;
}

describe('multiplayer-weergave', () => {
  it('stoelen heen en terug', () => {
    for (const me of [0, 1, 2, 3] as Seat[])
      for (const s of [0, 1, 2, 3] as Seat[]) {
        expect(fromView(toView(s, me), me)).toBe(s);
        expect(toView(me, me)).toBe(0);
      }
  });

  it('jij zit op 0 en ziet alleen je eigen kaarten', () => {
    const game = playedGame();
    for (const me of [1, 2, 3] as Seat[]) {
      const v = viewFor(game, me);
      expect(v.round.hands[0]).toEqual(game.round.hands[me]);
      for (const i of [1, 2, 3]) {
        const abs = fromView(i as Seat, me);
        expect(v.round.hands[i]!.length).toBe(game.round.hands[abs]!.length);
        expect(v.round.hands[i]!.every((c) => c === HIDDEN_CARD)).toBe(true);
      }
    }
  });

  it('beurt, uitkomer en kaarten op tafel draaien mee', () => {
    const game = playedGame();
    const me: Seat = 3;
    const v = viewFor(game, me);
    expect(v.round.turn).toBe(toView(game.round.turn, me));
    expect(v.round.currentTrick.cards.map((c) => c.seat)).toEqual(
      game.round.currentTrick.cards.map((c) => toView(c.seat, me)),
    );
    // Wat jij mag spelen is in beide weergaven hetzelfde als jij aan de beurt bent.
    if (game.round.turn === me) {
      expect(playableCards(v.round, game.rules)).toEqual(playableCards(game.round, game.rules));
    }
  });

  it('teams wisselen voor spelers op een oneven stoel', () => {
    const game = playedGame();
    expect(viewFor(game, 1).round.playingTeam).toBe(1);
    expect(viewFor(game, 2).round.playingTeam).toBe(0);
    const g: GameState = {
      ...game,
      scores: [
        {
          playingTeam: 0,
          points: [100, 62],
          roem: [20, 0],
          nat: false,
          pit: null,
          total: [120, 62],
        },
      ],
    };
    expect(totals(viewFor(g, 1))).toEqual([62, 120]);
    expect(totals(viewFor(g, 2))).toEqual([120, 62]);
  });

  it('geheime afspraak van de tegenpartij blijft geheim', () => {
    const game = playedGame();
    const v0 = viewFor(game, 0);
    const v1 = viewFor(game, 1);
    expect(Object.values(v0.signals.opponentAgreement).every((m) => m === null)).toBe(true);
    expect(v1.signals.agreement).toEqual(game.signals.opponentAgreement);
    expect(Object.values(v1.signals.opponentAgreement).every((m) => m === null)).toBe(true);
  });

  it('wat een tegenstander seinde zie je wel, maar niet wat het betekent', () => {
    const game = playedGame();
    const { state } = sendSignal(
      game.signals,
      game.round,
      game.rules,
      1,
      'knipoog',
      createRng(1),
      () => 0,
    );
    const g = { ...game, signals: state };
    const e = viewFor(g, 0).signals.log.at(-1)!;
    expect(e.from).toBe(1);
    expect(e.intended).toBeNull();
    const own = viewFor(g, 1).signals.log.at(-1)!;
    expect(own.from).toBe(0);
    expect(own.intended).not.toBeNull();
  });

  it('een heel gespeeld spel blijft consistent in elke weergave', () => {
    let game = playedGame();
    const rng = createRng(2);
    let r = game.round;
    while (r.phase !== 'klaar') {
      const seat = r.turn;
      r = smartBotStep(r, game.rules, rng, {
        personality: PERSONALITIES[seat === 0 ? 2 : (seat as 1 | 2 | 3)],
        difficulty: 'gemiddeld',
      });
    }
    game = finishRound({ ...game, round: r });
    const [a, b] = totals(game);
    expect(totals(viewFor(game, 1))).toEqual([b, a]);
  });
});

describe('viewFor bij bieden', () => {
  it('draait biedingen en contract mee', () => {
    let g = createGame(BIDDING_RULES, 3);
    g = { ...g, round: placeBid(g.round, g.rules, 0, 90, 'harten') };
    const v = viewFor(g, 2);
    expect(v.round.contract).toMatchObject({ seat: 2, value: 90 });
    expect(v.round.bids?.[0]).toMatchObject({ seat: 2, bid: { seat: 2 } });
    expect(v.round.turn).toBe(3);
  });
});
