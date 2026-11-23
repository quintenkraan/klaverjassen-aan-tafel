import { cardPoints, partnerOf, strength, teamOf } from '../cards';
import type { Rng } from '../rng';
import { roemOf } from '../roem';
import { bidOptions, chooseTrump, passBid, playableCards, playCard } from '../round';
import { trickWinner } from '../rules';
import type { Card, Meaning, Rank, RoundState, Rules, Seat, Suit, Trick } from '../types';
import { buildKnowledge, isBoss, type Knowledge } from './knowledge';
import {
  DIFFICULTY,
  effectiveMemory,
  profileFor,
  type BotProfile,
  type Difficulty,
} from './profile';

const TRUMP_WEIGHT: Record<Rank, number> = {
  B: 5,
  '9': 4,
  A: 3,
  '10': 2.5,
  H: 1.5,
  V: 1.5,
  '8': 1,
  '7': 1,
};

/** Handwaardering voor een troefkleur. Rond 9-10 is een redelijke troefhand. */
export function handStrength(hand: Card[], trump: Suit): number {
  let v = 0;
  for (const c of hand) {
    if (c.suit === trump) v += TRUMP_WEIGHT[c.rank];
    else if (c.rank === 'A') v += 2;
    else if (c.rank === '10' && hand.some((h) => h.suit === c.suit && h.rank === 'A')) v += 1;
  }
  const has = (r: Rank) => hand.some((c) => c.suit === trump && c.rank === r);
  if (has('H') && has('V')) v += 1.5;
  return v;
}

function chooseBid(round: RoundState, rules: Rules, rng: Rng, p: BotProfile): RoundState {
  const seat = round.turn;
  const opts = bidOptions(round, rules);
  const hand = round.hands[seat]!;
  const noise = p.difficulty === 'makkelijk' ? (rng() - 0.5) * 4 : 0;
  const ranked = opts.suits
    .map((s) => ({ s, v: handStrength(hand, s) + noise }))
    .sort((a, b) => b.v - a.v);
  const best = ranked[0];
  const threshold = 11 - p.personality.aggression * 3;
  if (best && (!opts.canPass || best.v >= threshold))
    return chooseTrump(round, rules, seat, best.s);
  return passBid(round, rules, seat);
}

// ---------- kaart kiezen ----------

interface Ctx {
  seat: Seat;
  trump: Suit;
  trick: Trick;
  k: Knowledge;
  p: BotProfile;
  weArePlaying: boolean;
  /** Wat deze bot denkt dat zijn maat heeft geseind. */
  hint: Meaning | null;
}

const pts = (c: Card, trump: Suit) => cardPoints(c, trump);
/** Hoe "duur" het is om een kaart weg te geven: punten, en troef houden we liever. */
const cost = (c: Card, trump: Suit) =>
  pts(c, trump) + (c.suit === trump ? 6 + strength(c, trump) : strength(c, trump) * 0.1);

const withCard = (ctx: Ctx, card: Card): Trick => ({
  ...ctx.trick,
  cards: [...ctx.trick.cards, { seat: ctx.seat, card }],
});
const wins = (ctx: Ctx, card: Card) => trickWinner(withCard(ctx, card), ctx.trump) === ctx.seat;
const roemWith = (ctx: Ctx, card: Card) =>
  roemOf(
    withCard(ctx, card).cards.map((pc) => pc.card),
    ctx.trump,
  );

function minBy<T>(items: T[], f: (x: T) => number): T {
  return items.reduce((best, x) => (f(x) < f(best) ? x : best));
}
function maxBy<T>(items: T[], f: (x: T) => number): T {
  return items.reduce((best, x) => (f(x) > f(best) ? x : best));
}

function opponentsOf(seat: Seat): Seat[] {
  return ([0, 1, 2, 3] as Seat[]).filter((s) => teamOf(s) !== teamOf(seat));
}

function lead(legal: Card[], ctx: Ctx): Card {
  const { trump, k, seat } = ctx;
  const opps = opponentsOf(seat);
  const trumps = legal.filter((c) => c.suit === trump);
  const oppsMayTrump =
    k.unseen.some((u) => u.suit === trump) && opps.some((o) => !k.voids[o]!.has(trump));

  // Spelende partij: troef trekken met de hoogste troef als die baas is.
  if (ctx.weArePlaying && trumps.length > 0 && oppsMayTrump) {
    const top = maxBy(trumps, (c) => strength(c, trump));
    if (isBoss(top, k, trump)) return top;
    if (trumps.length >= 4 && ctx.p.personality.aggression > 0.6) {
      return minBy(trumps, (c) => strength(c, trump));
    }
  }

  // Bazen in bijkleuren (azen, of tienen als de aas weg is) waar niemand op kan troeven.
  const bosses = legal.filter(
    (c) =>
      c.suit !== trump &&
      isBoss(c, k, trump) &&
      (!oppsMayTrump || opps.every((o) => !k.voids[o]!.has(c.suit))),
  );
  if (bosses.length > 0) return maxBy(bosses, (c) => pts(c, trump));

  // Anders laag uitkomen, en geen kale tien voorspelen.
  const side = legal.filter((c) => c.suit !== trump);
  if (side.length > 0) {
    return minBy(side, (c) => cost(c, trump) + (c.rank === '10' ? 15 : 0));
  }
  return minBy(trumps, (c) => strength(c, trump));
}

function follow(legal: Card[], ctx: Ctx): Card {
  const { trump, trick, k, seat } = ctx;
  const partner = partnerOf(seat);
  const last = trick.cards.length === 3;
  const winner = trickWinner(trick, trump);
  const trickPoints = trick.cards.reduce((s, pc) => s + pts(pc.card, trump), 0);

  // Maat heeft de slag en die is veilig: punten (en roem) bijgooien.
  if (winner === partner) {
    const wc = trick.cards.find((pc) => pc.seat === partner)!.card;
    const after = opponentsOf(seat).filter((o) => !trick.cards.some((pc) => pc.seat === o));
    const safe =
      last ||
      (isBoss(wc, k, trump) &&
        (wc.suit === trump || after.every((o) => !k.voids[o]!.has(wc.suit))));
    if (safe) {
      return maxBy(legal, (c) => pts(c, trump) + roemWith(ctx, c) - (c.suit === trump ? 12 : 0));
    }
  }

  const winners = legal.filter((c) => wins(ctx, c));
  if (winners.length > 0 && winner !== partner) {
    if (last) {
      return maxBy(
        winners,
        (c) => pts(c, trump) + roemWith(ctx, c) - (c.suit === trump ? strength(c, trump) : 0),
      );
    }
    const safeWinners = winners.filter((c) => isBoss(c, k, trump));
    if (safeWinners.length > 0) {
      return maxBy(
        safeWinners,
        (c) => pts(c, trump) - (c.suit === trump ? strength(c, trump) * 2 : 0),
      );
    }
    if (trickPoints >= 10 || ctx.p.personality.aggression > 0.7) {
      return minBy(winners, (c) => cost(c, trump));
    }
  }

  // Niet winnen: zo goedkoop mogelijk weggooien, en geen roem cadeau doen.
  const oppWins = (c: Card) => teamOf(trickWinner(withCard(ctx, c), trump)) !== teamOf(seat);
  return minBy(
    legal,
    (c) =>
      cost(c, trump) +
      (oppWins(c)
        ? roemWith(ctx, c) -
          roemOf(
            trick.cards.map((pc) => pc.card),
            trump,
          )
        : 0),
  );
}

/** Uitkomen op basis van een (mogelijk verkeerd begrepen) sein van de maat. */
function leadOnHint(legal: Card[], ctx: Ctx): Card | null {
  const { hint, trump, k } = ctx;
  if (!hint) return null;
  if (hint === 'troefboer') {
    const trumps = legal.filter((c) => c.suit === trump);
    return ctx.weArePlaying && trumps.length > 0 ? minBy(trumps, (c) => strength(c, trump)) : null;
  }
  const suit = hint.slice('speel-'.length) as Suit;
  const inSuit = legal.filter((c) => c.suit === suit);
  if (suit === trump || inSuit.length === 0) return null;
  const top = maxBy(inSuit, (c) => strength(c, trump));
  return isBoss(top, k, trump) ? top : minBy(inSuit, (c) => strength(c, trump));
}

export function chooseCard(
  round: RoundState,
  rules: Rules,
  rng: Rng,
  p: BotProfile,
  hint: Meaning | null = null,
): Card {
  const legal = playableCards(round, rules);
  if (legal.length <= 1 || rng() < DIFFICULTY[p.difficulty].mistake) {
    return legal[Math.floor(rng() * legal.length)]!;
  }
  const seat = round.turn;
  const ctx: Ctx = {
    seat,
    trump: round.trump!,
    trick: round.currentTrick,
    k: buildKnowledge(round, rules, seat, effectiveMemory(p)),
    p,
    weArePlaying: round.playingTeam === teamOf(seat),
    hint,
  };
  if (ctx.trick.cards.length > 0) return follow(legal, ctx);
  return leadOnHint(legal, ctx) ?? lead(legal, ctx);
}

/** Eén stap van een bot met persoonlijkheid: troef bepalen of een kaart spelen. */
export function smartBotStep(
  round: RoundState,
  rules: Rules,
  rng: Rng,
  p: BotProfile,
  hint: Meaning | null = null,
): RoundState {
  if (round.phase === 'bieden') return chooseBid(round, rules, rng, p);
  return playCard(round, rules, round.turn, chooseCard(round, rules, rng, p, hint));
}

/** Gemak: bot op de stoel die aan de beurt is, met de vaste persoonlijkheid van die stoel. */
export function botStep(
  round: RoundState,
  rules: Rules,
  rng: Rng,
  difficulty: Difficulty,
  hint: Meaning | null = null,
): RoundState {
  const seat = round.turn;
  if (seat === 0) throw new Error('Stoel 0 is de menselijke speler');
  return smartBotStep(round, rules, rng, profileFor(seat, difficulty), hint);
}
