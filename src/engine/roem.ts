import { RANKS, SUITS } from './cards';
import type { Card, Trump } from './types';

/**
 * Roem in één slag:
 * - drie op een rij 20, vier op een rij 50 (natuurlijke volgorde 7-8-9-10-B-V-H-A)
 * - stuk (H + V van troef) 20, telt bovenop een reeks
 * - vier gelijke kaarten 100, vier boeren 200
 * - bij bieden (jullie variant): alleen vier gelijke plaatjes (B, V, H, A), altijd 100
 */
export function roemOf(cards: Card[], trump: Trump, bidding = false): number {
  let roem = 0;

  const first = cards[0];
  if (first && cards.length === 4 && cards.every((c) => c.rank === first.rank)) {
    if (!bidding) roem += first.rank === 'B' ? 200 : 100;
    else if (['B', 'V', 'H', 'A'].includes(first.rank)) roem += 100;
  }

  for (const suit of SUITS) {
    const idx = cards
      .filter((c) => c.suit === suit)
      .map((c) => RANKS.indexOf(c.rank))
      .sort((a, b) => a - b);
    let run = 1;
    let best = idx.length > 0 ? 1 : 0;
    for (let i = 1; i < idx.length; i++) {
      run = idx[i] === idx[i - 1]! + 1 ? run + 1 : 1;
      best = Math.max(best, run);
    }
    if (best >= 4) roem += 50;
    else if (best === 3) roem += 20;
  }

  const hasTrump = (rank: Card['rank']) => cards.some((c) => c.suit === trump && c.rank === rank);
  if (hasTrump('H') && hasTrump('V')) roem += 20;

  return roem;
}
