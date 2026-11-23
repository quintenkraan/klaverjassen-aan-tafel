import { describe, expect, it } from 'vitest';
import { cardPoints, createDeck } from './cards';
import { roemOf } from './roem';
import { legalCards, trickWinner } from './rules';
import { cs, trick } from './testUtils';
import type { Suit } from './types';

const H: Suit = 'harten';

describe('kaarten', () => {
  it('32 kaarten, 152 punten per kleurverdeling (+10 laatste slag = 162)', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(32);
    expect(deck.reduce((s, c) => s + cardPoints(c, H), 0)).toBe(152);
  });
});

describe('trickWinner', () => {
  it('hoogste van de gevraagde kleur wint', () => {
    expect(trickWinner(trick(0, 'k10', 'kA', 'k7', 'kH'), H)).toBe(1);
  });
  it('andere kleur wint niet, ook al is hij hoger', () => {
    expect(trickWinner(trick(0, 'k7', 'rA', 's10', 'k8'), H)).toBe(3);
  });
  it('troef wint, troefvolgorde B > 9 > A', () => {
    expect(trickWinner(trick(0, 'kA', 'hA', 'h9', 'k10'), H)).toBe(2);
    expect(trickWinner(trick(0, 'h9', 'hB', 'hA', 'h10'), H)).toBe(1);
  });
});

describe('legalCards', () => {
  it('bekennen verplicht', () => {
    expect(legalCards(cs('k7', 'kA', 'h9'), trick(0, 'kB'), H, 'rotterdams')).toEqual(cs('k7', 'kA'));
  });
  it('troef gevraagd: overtroeven als het kan', () => {
    expect(legalCards(cs('h7', 'hB', 'kA'), trick(0, 'hV'), H, 'rotterdams')).toEqual(cs('hB'));
  });
  it('troef gevraagd, niet over kunnen: elke troef mag', () => {
    expect(legalCards(cs('h7', 'h9', 'kA'), trick(0, 'hB'), H, 'rotterdams')).toEqual(cs('h7', 'h9'));
  });
  it('niet kunnen bekennen: troeven', () => {
    expect(legalCards(cs('r7', 'h8'), trick(0, 'kA'), H, 'rotterdams')).toEqual(cs('h8'));
  });
  it('al getroefd door tegenstander: overtroeven', () => {
    expect(legalCards(cs('h7', 'h9', 'r8'), trick(0, 'kA', 'h10'), H, 'rotterdams')).toEqual(cs('h9'));
  });
  it('ondertroeven mag niet als je iets anders hebt', () => {
    expect(legalCards(cs('h7', 'r8'), trick(0, 'kA', 'h10'), H, 'rotterdams')).toEqual(cs('r8'));
  });
  it('ondertroeven mag als je alleen troef hebt', () => {
    expect(legalCards(cs('h7', 'h8'), trick(0, 'kA', 'h10'), H, 'rotterdams')).toEqual(cs('h7', 'h8'));
  });
  it('maat heeft de slag: amsterdams vrij, rotterdams troefplicht', () => {
    const t = trick(0, 'kA', 'k7');
    expect(legalCards(cs('r7', 'h8'), t, H, 'amsterdams')).toEqual(cs('r7', 'h8'));
    expect(legalCards(cs('r7', 'h8'), t, H, 'rotterdams')).toEqual(cs('h8'));
  });
  it('amsterdams: maat heeft getroefd, je hoeft niet over te troeven', () => {
    const t = trick(0, 'kA', 'hV', 'kH');
    expect(legalCards(cs('r7', 'hB'), t, H, 'amsterdams')).toEqual(cs('r7', 'hB'));
  });
  it('uitkomen: alles mag', () => {
    expect(legalCards(cs('r7', 'hB'), trick(0), H, 'rotterdams')).toEqual(cs('r7', 'hB'));
  });
});

describe('roem', () => {
  const S: Suit = 'schoppen';
  it('drie op een rij 20', () => expect(roemOf(cs('k7', 'k8', 'k9', 'rA'), S)).toBe(20));
  it('10-B-V is ook een reeks', () => expect(roemOf(cs('k10', 'kB', 'kV', 'r7'), S)).toBe(20));
  it('vier op een rij 50', () => expect(roemOf(cs('kB', 'kV', 'kH', 'kA'), S)).toBe(50));
  it('stuk 20', () => expect(roemOf(cs('hH', 'hV', 'k7', 'r9'), H)).toBe(20));
  it('stuk telt bovenop reeks', () => expect(roemOf(cs('hV', 'hH', 'hA', 'k7'), H)).toBe(40));
  it('H+V van niet-troef is geen stuk', () => expect(roemOf(cs('kH', 'kV', 'r7', 's9'), H)).toBe(0));
  it('vier boeren 200, vier azen 100', () => {
    expect(roemOf(cs('kB', 'rB', 'hB', 'sB'), H)).toBe(200);
    expect(roemOf(cs('kA', 'rA', 'hA', 'sA'), H)).toBe(100);
  });
  it('geen reeks over kleuren of met gat', () => {
    expect(roemOf(cs('k7', 'r8', 'h9', 's10'), S)).toBe(0);
    expect(roemOf(cs('k7', 'k8', 'k10', 'r7'), S)).toBe(0);
  });
});
