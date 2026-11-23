import { partnerOf, strength } from './cards';
import type { Card, Seat, Suit, Trick, Variant } from './types';

function beats(a: Card, b: Card, trump: Suit): boolean {
  if (a.suit === b.suit) return strength(a, trump) > strength(b, trump);
  return a.suit === trump;
}

/** Wie wint (of heeft op dit moment) de slag. Trick moet minstens één kaart bevatten. */
export function trickWinner(trick: Trick, trump: Suit): Seat {
  let best = trick.cards[0];
  if (!best) throw new Error('Lege slag heeft geen winnaar');
  for (const pc of trick.cards.slice(1)) if (beats(pc.card, best.card, trump)) best = pc;
  return best.seat;
}

/**
 * Welke kaarten mag de speler die aan de beurt is spelen.
 * - Bekennen verplicht. Bij troef gevraagd: overtroeven als dat kan.
 * - Niet kunnen bekennen: troeven, en overtroeven als er al getroefd is.
 * - Niet kunnen overtroeven: ondertroeven mag niet, tenzij je alleen nog troef hebt.
 * - Amsterdams: heeft je maat de slag, dan mag je alles bijspelen.
 */
export function legalCards(hand: Card[], trick: Trick, trump: Suit, variant: Variant): Card[] {
  const lead = trick.cards[0];
  if (!lead) return hand;

  const highestTrump = Math.max(
    -1,
    ...trick.cards.filter((pc) => pc.card.suit === trump).map((pc) => strength(pc.card, trump)),
  );
  const higherTrumps = hand.filter(
    (c) => c.suit === trump && strength(c, trump) > highestTrump,
  );

  const follow = hand.filter((c) => c.suit === lead.card.suit);
  if (follow.length > 0) {
    if (lead.card.suit === trump && higherTrumps.length > 0) return higherTrumps;
    return follow;
  }

  const me = ((trick.leader + trick.cards.length) % 4) as Seat;
  if (variant === 'amsterdams' && trickWinner(trick, trump) === partnerOf(me)) return hand;

  if (!hand.some((c) => c.suit === trump)) return hand;
  if (higherTrumps.length > 0) return higherTrumps;

  const nonTrumps = hand.filter((c) => c.suit !== trump);
  return nonTrumps.length > 0 ? nonTrumps : hand;
}
