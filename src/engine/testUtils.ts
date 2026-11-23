import type { Card, CompletedTrick, Rank, Seat, Suit, Trick } from './types';

const SUIT_CODE: Record<string, Suit> = { k: 'klaveren', r: 'ruiten', h: 'harten', s: 'schoppen' };

/** Korte notatie voor tests: 'hB' = harten boer, 'k10' = klaveren tien. */
export function c(code: string): Card {
  const suit = SUIT_CODE[code[0]!];
  if (!suit) throw new Error(`Onbekende kleur in ${code}`);
  return { suit, rank: code.slice(1) as Rank };
}

export function cs(...codes: string[]): Card[] {
  return codes.map(c);
}

/** Slag met kaarten in speelvolgorde vanaf `leader`. */
export function trick(leader: Seat, ...codes: string[]): Trick {
  return {
    leader,
    cards: codes.map((code, i) => ({ seat: ((leader + i) % 4) as Seat, card: c(code) })),
  };
}

export function done(winner: Seat, points: number, roem = 0): CompletedTrick {
  return { leader: 0, cards: [], winner, points, roem };
}
