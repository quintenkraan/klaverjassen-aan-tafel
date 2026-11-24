import { describe, expect, it } from 'vitest';
import { bidEstimate, smartBotStep } from './ai/smart';
import { profileFor } from './ai/profile';
import { cardPoints, createDeck } from './cards';
import { BIDDING_RULES, createGame, finishRound, isGameOver, roundTens, totals } from './game';
import { createRng } from './rng';
import { roemOf } from './roem';
import {
  bidOptions,
  minBidFor,
  passBid,
  PIT_BID,
  placeBid,
  playableCards,
  scoreRound,
  startRound,
} from './round';
import { cs, done } from './testUtils';
import type { GameState, Seat } from './types';

const rules = BIDDING_RULES;
const round = () => startRound(3, rules, createRng(1));

describe('bieden: wie, hoeveel, en wanneer is het klaar', () => {
  it('de speler na de deler begint; eerste bod minimaal 80, sans 70', () => {
    const r = round();
    expect(r.turn).toBe(0);
    expect(bidOptions(r, rules).minBid).toMatchObject({ harten: 80, sans: 70 });
    expect(() => placeBid(r, rules, 0, 70, 'harten')).toThrow();
    expect(() => placeBid(r, rules, 0, 85, 'harten')).toThrow();
  });

  it('overbieden: 10 hoger, sans mag gelijk boven een kleur', () => {
    expect(minBidFor({ seat: 0, value: 80, trump: 'harten' }, 'schoppen')).toBe(90);
    expect(minBidFor({ seat: 0, value: 80, trump: 'harten' }, 'sans')).toBe(80);
    expect(minBidFor({ seat: 0, value: 80, trump: 'sans' }, 'harten')).toBe(90);
    expect(minBidFor({ seat: 0, value: 80, trump: 'sans' }, 'sans')).toBe(90);
    expect(minBidFor({ seat: 0, value: PIT_BID, trump: 'harten' }, 'sans')).toBe(PIT_BID);
    expect(minBidFor({ seat: 0, value: PIT_BID, trump: 'sans' }, 'harten')).toBeNull();
  });

  it('drie keer passen na een bod: de bieder mag nog verhogen of laten staan', () => {
    let r = placeBid(round(), rules, 0, 80, 'harten');
    r = passBid(r, rules, 1);
    r = passBid(r, rules, 2);
    r = passBid(r, rules, 3);
    expect(r).toMatchObject({ phase: 'bieden', turn: 0, lastChance: true });
    const kept = passBid(r, rules, 0);
    expect(kept).toMatchObject({ phase: 'spelen', trump: 'harten', playingTeam: 0, turn: 0 });
    const raised = placeBid(r, rules, 0, 100, 'harten');
    expect(raised).toMatchObject({ phase: 'spelen', contract: { value: 100 } });
  });

  it('overbieden geeft de anderen weer een beurt', () => {
    let r = placeBid(round(), rules, 0, 80, 'harten');
    r = placeBid(r, rules, 1, 90, 'schoppen');
    r = passBid(r, rules, 2);
    r = passBid(r, rules, 3);
    expect(r.phase).toBe('bieden');
    r = passBid(r, rules, 0);
    expect(r).toMatchObject({ turn: 1, lastChance: true });
    r = passBid(r, rules, 1);
    expect(r).toMatchObject({ trump: 'schoppen', playingTeam: 1, turn: 0 });
  });

  it('iedereen past: ingepast, de volgende deler deelt opnieuw zonder telling', () => {
    const g = createGame(rules, 7);
    let r = g.round;
    for (const s of [0, 1, 2, 3] as Seat[]) r = passBid(r, rules, s);
    expect(r.phase).toBe('klaar');
    const next = finishRound({ ...g, round: r });
    expect(next.scores).toHaveLength(0);
    expect(next.round).toMatchObject({ dealer: 0, phase: 'bieden', turn: 1 });
  });
});

describe('telling bij bieden', () => {
  const bid = (value: number) => ({ seat: 0 as Seat, value, trump: 'harten' as const });

  it('bod gehaald (punten + roem): ieder krijgt zijn eigen punten', () => {
    const tricks = [...Array.from({ length: 5 }, () => done(0, 20, 0)), done(0, 0, 20)];
    tricks.push(done(1, 31), done(1, 31));
    const s = scoreRound(tricks, 0, bid(120));
    expect(s).toMatchObject({ nat: false, total: [120, 62] });
  });

  it('bod niet gehaald: nat, de tegenpartij krijgt alle punten en roem', () => {
    const tricks = [...Array.from({ length: 6 }, () => done(0, 20)), done(1, 21, 20), done(1, 21)];
    const s = scoreRound(tricks, 0, bid(130));
    expect(s).toMatchObject({ nat: true, total: [0, 182] });
  });

  it('pit-bod alleen gehaald met alle slagen', () => {
    const all = Array.from({ length: 8 }, () => done(0, 20));
    expect(scoreRound(all, 0, bid(PIT_BID)).nat).toBe(false);
    const one = [...all.slice(1), done(1, 20)];
    expect(scoreRound(one, 0, bid(PIT_BID)).nat).toBe(true);
  });

  it('afronden op tientallen: 5 naar beneden, 6 naar boven', () => {
    expect([132, 30, 76, 86, 135, 136, 262].map(roundTens)).toEqual([13, 3, 8, 9, 13, 14, 26]);
  });

  it('sans: geen troef, 130 punten in totaal, geen stuk', () => {
    const total = createDeck().reduce((sum, card) => sum + cardPoints(card, 'sans'), 0);
    expect(total + 10).toBe(130);
    expect(roemOf(cs('hH', 'hV', 'k7', 'r8'), 'sans', true)).toBe(0);
    expect(roemOf(cs('hH', 'hV', 'k7', 'r8'), 'harten', true)).toBe(20);
  });

  it('vier gelijke plaatjes 100 (ook boeren), vier tienen niks', () => {
    expect(roemOf(cs('hB', 'kB', 'rB', 'sB'), 'harten', true)).toBe(100);
    expect(roemOf(cs('h10', 'k10', 'r10', 's10'), 'harten', true)).toBe(0);
  });
});

describe('bots bieden volgens de tips', () => {
  it('Boer of Nel: 80, beide: 90, per Aas 10 erbij', () => {
    expect(bidEstimate(cs('hB', 'h8', 'h7', 'k8', 'k7', 'r8', 'r7', 's8'), 'harten')).toBe(80);
    expect(bidEstimate(cs('hB', 'h9', 'h7', 'k8', 'k7', 'r8', 'r7', 's8'), 'harten')).toBe(90);
    expect(bidEstimate(cs('hB', 'h9', 'h7', 'kA', 'k7', 'r8', 'r7', 's8'), 'harten')).toBe(100);
    expect(bidEstimate(cs('hV', 'h8', 'h7', 'kA', 'k7', 'r8', 'r7', 's8'), 'harten')).toBeNull();
  });

  it('een heel potje met alleen bots eindigt op 150 afgeronde punten', () => {
    let g: GameState = createGame(rules, 42);
    const rng = createRng(9);
    for (let step = 0; step < 20000 && !isGameOver(g); step++) {
      const r = g.round;
      if (r.phase === 'klaar') {
        g = finishRound(g);
        continue;
      }
      const seat = r.turn;
      const p = profileFor((seat === 0 ? 2 : seat) as 1 | 2 | 3, 'gemiddeld');
      const next = smartBotStep(r, rules, rng, p);
      if (next.phase === 'spelen' && r.phase === 'spelen')
        expect(playableCards(r, rules).length).toBeGreaterThan(0);
      g = { ...g, round: next };
    }
    expect(isGameOver(g)).toBe(true);
    expect(Math.max(...totals(g))).toBeGreaterThanOrEqual(150);
    expect(g.scores.every((s) => s.contract)).toBe(true);
  });
});
