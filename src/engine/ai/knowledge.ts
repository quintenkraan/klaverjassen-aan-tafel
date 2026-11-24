import { cardId, createDeck, sameCard, strength } from '../cards';
import type { Card, PlayedCard, RoundState, Rules, Seat, Suit, Trump } from '../types';

/** Wat een bot denkt te weten. Met slecht geheugen vergeet hij gespeelde kaarten. */
export interface Knowledge {
  /** Kaarten die volgens de bot nog bij anderen kunnen zitten. */
  unseen: Card[];
  /** Per stoel: kleuren waarvan de bot weet dat die speler ze niet meer heeft. */
  voids: Set<Suit>[];
}

function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Vast per (spel, bot, slag): of de bot die slag nog weet. */
function remembers(round: RoundState, seat: Seat, trickIndex: number, memory: number): boolean {
  if (memory >= 1) return true;
  const first = round.tricks[0]?.cards[0];
  const tag = `${round.dealer}:${first ? cardId(first.card) : ''}:${seat}:${trickIndex}`;
  return hash(tag) < memory;
}

export function buildKnowledge(
  round: RoundState,
  rules: Rules,
  seat: Seat,
  memory: number,
): Knowledge {
  const trump = round.trump;
  const seen: PlayedCard[] = [];
  const voids: Set<Suit>[] = [new Set(), new Set(), new Set(), new Set()];

  const tricks = [...round.tricks, round.currentTrick];
  tricks.forEach((trick, i) => {
    const isCurrent = i === tricks.length - 1;
    if (!isCurrent && !remembers(round, seat, i, memory)) return;
    seen.push(...trick.cards);
    const lead = trick.cards[0]?.card.suit;
    if (!lead) return;
    for (const pc of trick.cards.slice(1)) {
      if (pc.card.suit === lead) continue;
      voids[pc.seat]!.add(lead);
      if (
        trump &&
        trump !== 'sans' &&
        lead !== trump &&
        pc.card.suit !== trump &&
        rules.variant === 'rotterdams'
      ) {
        voids[pc.seat]!.add(trump);
      }
    }
  });

  const hand = round.hands[seat]!;
  const unseen = createDeck().filter(
    (c) => !hand.some((h) => sameCard(h, c)) && !seen.some((pc) => sameCard(pc.card, c)),
  );
  return { unseen, voids };
}

/** Is dit de hoogste nog niet geziene kaart van zijn kleur? */
export function isBoss(card: Card, k: Knowledge, trump: Trump): boolean {
  return !k.unseen.some((u) => u.suit === card.suit && strength(u, trump) > strength(card, trump));
}
