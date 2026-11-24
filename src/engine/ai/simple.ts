import { bidOptions, chooseTrump, passBid, placeBid, playableCards, playCard } from '../round';
import type { Rng } from '../rng';
import type { RoundState, Rules, Suit } from '../types';

/**
 * Eenvoudige bot (F3): kiest troef in de kleur waarvan hij de meeste kaarten heeft,
 * past soms als dat mag, en speelt een willekeurige legale kaart.
 * Wordt in F5 vervangen door bots met heuristieken en persoonlijkheid.
 */
export function simpleBotStep(round: RoundState, rules: Rules, rng: Rng): RoundState {
  const seat = round.turn;
  if (round.phase === 'bieden') {
    const opts = bidOptions(round, rules);
    const hand = round.hands[seat]!;
    const count = (s: Suit) => hand.filter((c) => c.suit === s).length;
    if (opts.minBid) {
      const suit = (['klaveren', 'ruiten', 'harten', 'schoppen'] as Suit[]).sort(
        (a, b) => count(b) - count(a),
      )[0]!;
      const min = opts.minBid[suit];
      if (!round.lastChance && min !== null && min <= 90 && count(suit) >= 4)
        return placeBid(round, rules, seat, min, suit);
      return passBid(round, rules, seat);
    }
    const best = [...opts.suits].sort((a, b) => count(b) - count(a))[0];
    if (!best || (opts.canPass && count(best) < 3 && rng() < 0.8))
      return passBid(round, rules, seat);
    return chooseTrump(round, rules, seat, best);
  }
  const options = playableCards(round, rules);
  const pick = options[Math.floor(rng() * options.length)];
  if (!pick) throw new Error('Bot heeft geen speelbare kaart');
  return playCard(round, rules, seat, pick);
}
