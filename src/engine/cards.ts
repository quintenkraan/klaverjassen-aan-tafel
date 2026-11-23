import type { Card, Rank, Seat, Suit, Team } from './types';

export const SUITS: readonly Suit[] = ['klaveren', 'ruiten', 'harten', 'schoppen'];
/** Natuurlijke volgorde, gebruikt voor roem (reeksen). */
export const RANKS: readonly Rank[] = ['7', '8', '9', '10', 'B', 'V', 'H', 'A'];

const TRUMP_ORDER: readonly Rank[] = ['7', '8', 'V', 'H', '10', 'A', '9', 'B'];
const PLAIN_ORDER: readonly Rank[] = ['7', '8', '9', 'B', 'V', 'H', '10', 'A'];

const TRUMP_POINTS: Record<Rank, number> = {
  '7': 0,
  '8': 0,
  '9': 14,
  '10': 10,
  B: 20,
  V: 3,
  H: 4,
  A: 11,
};
const PLAIN_POINTS: Record<Rank, number> = {
  '7': 0,
  '8': 0,
  '9': 0,
  '10': 10,
  B: 2,
  V: 3,
  H: 4,
  A: 11,
};

export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

export function cardPoints(card: Card, trump: Suit): number {
  return card.suit === trump ? TRUMP_POINTS[card.rank] : PLAIN_POINTS[card.rank];
}

/** Sterkte binnen de eigen kleur (hoger = sterker). */
export function strength(card: Card, trump: Suit): number {
  return (card.suit === trump ? TRUMP_ORDER : PLAIN_ORDER).indexOf(card.rank);
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function cardId(card: Card): string {
  return `${card.suit}-${card.rank}`;
}

/** Hand sorteren voor weergave: troef eerst, kleuren afwisselend zwart/rood, hoog naar laag. */
export function sortHand(hand: Card[], trump: Suit | null): Card[] {
  const order: Suit[] = ['klaveren', 'ruiten', 'schoppen', 'harten'];
  const suitRank = (s: Suit) => (s === trump ? -1 : order.indexOf(s));
  const rankOf = (c: Card) => (c.suit === trump ? TRUMP_ORDER : PLAIN_ORDER).indexOf(c.rank);
  return [...hand].sort((a, b) => suitRank(a.suit) - suitRank(b.suit) || rankOf(b) - rankOf(a));
}

export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

export function teamOf(seat: Seat): Team {
  return (seat % 2) as Team;
}

export function partnerOf(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}
