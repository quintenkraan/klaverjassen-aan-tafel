import { cardId, cardPoints, createDeck, nextSeat, sameCard, SUITS, teamOf } from './cards';
import { shuffle, type Rng } from './rng';
import { roemOf } from './roem';
import { legalCards, trickWinner } from './rules';
import type {
  Bid,
  BidOptions,
  Card,
  CompletedTrick,
  Pair,
  Phase,
  RoundScore,
  RoundState,
  Rules,
  Seat,
  Suit,
  Team,
  Trump,
} from './types';

/** Bieden: "pit" is het hoogste bod. */
export const PIT_BID = 170;
export const MIN_BID = 80;
export const MIN_SANS = 70;
export const TRUMPS: readonly Trump[] = [...SUITS, 'sans'];

/** Laagste toegestane bod op deze troef boven het huidige bod (null = kan niet hoger). */
export function minBidFor(current: Bid | null | undefined, trump: Trump): number | null {
  const floor = trump === 'sans' ? MIN_SANS : MIN_BID;
  if (!current) return floor;
  // Sans gaat bij een gelijk getal boven een kleur.
  const min = trump === 'sans' && current.trump !== 'sans' ? current.value : current.value + 10;
  const value = Math.max(floor, min);
  return value > PIT_BID ? null : value;
}

/** Schudden en delen in pakjes van 3-2-3, beginnend bij de speler na de deler. */
export function deal(dealer: Seat, rng: Rng): Card[][] {
  const deck = shuffle(createDeck(), rng);
  const hands: Card[][] = [[], [], [], []];
  let i = 0;
  for (const size of [3, 2, 3]) {
    for (let k = 1; k <= 4; k++) {
      hands[(dealer + k) % 4]!.push(...deck.slice(i, i + size));
      i += size;
    }
  }
  return hands;
}

export function startRound(dealer: Seat, rules: Rules, rng: Rng): RoundState {
  const first = nextSeat(dealer);
  const hands = deal(dealer, rng);
  return {
    dealer,
    hands,
    phase: 'bieden',
    turn: first,
    trump: null,
    trumpChooser: null,
    playingTeam: null,
    proposedSuit: rules.trumpMode === 'utrechts' ? SUITS[Math.floor(rng() * 4)]! : null,
    passes: 0,
    currentTrick: { leader: first, cards: [] },
    tricks: [],
    ...(rules.trumpMode === 'bieden' ? { bids: [], contract: null, lastChance: false } : {}),
  };
}

function assertTurn(state: RoundState, seat: Seat, phase: Phase): void {
  if (state.phase !== phase) throw new Error(`Niet in fase ${phase}`);
  if (state.turn !== seat) throw new Error(`Speler ${seat} is niet aan de beurt`);
}

/** Na vier keer passen moet de speler na de deler kiezen. */
export function bidOptions(state: RoundState, rules: Rules): BidOptions {
  if (state.phase !== 'bieden') return { canPass: false, suits: [] };
  const forced = state.passes >= 4;
  switch (rules.trumpMode) {
    case 'bieden': {
      const minBid = Object.fromEntries(
        TRUMPS.map((t) => [t, minBidFor(state.contract, t)]),
      ) as Record<Trump, number | null>;
      return { canPass: true, suits: [], minBid };
    }
    case 'verplicht':
      return { canPass: false, suits: [...SUITS] };
    case 'vrij':
      return { canPass: !forced, suits: [...SUITS] };
    case 'utrechts':
      return forced
        ? { canPass: false, suits: SUITS.filter((s) => s !== state.proposedSuit) }
        : { canPass: true, suits: state.proposedSuit ? [state.proposedSuit] : [] };
  }
}

export function passBid(state: RoundState, rules: Rules, seat: Seat): RoundState {
  assertTurn(state, seat, 'bieden');
  if (!bidOptions(state, rules).canPass) throw new Error('Passen mag hier niet');
  if (rules.trumpMode !== 'bieden')
    return { ...state, passes: state.passes + 1, turn: nextSeat(seat) };

  const bids = [...(state.bids ?? []), { seat, bid: null }];
  const contract = state.contract ?? null;
  // De bieder laat zijn bod staan: spelen maar.
  if (state.lastChance && contract) return startPlay({ ...state, bids }, contract);
  const passes = state.passes + 1;
  if (contract && passes >= 3)
    return { ...state, bids, passes, turn: contract.seat, lastChance: true };
  // Niemand biedt: ingepast, er wordt opnieuw gedeeld (finishRound regelt dat).
  if (!contract && passes >= 4) return { ...state, bids, passes, phase: 'klaar' };
  return { ...state, bids, passes, turn: nextSeat(seat) };
}

/** Bieden: een bod plaatsen (of, als laatste kans, je eigen bod verhogen). */
export function placeBid(
  state: RoundState,
  rules: Rules,
  seat: Seat,
  value: number,
  trump: Trump,
): RoundState {
  assertTurn(state, seat, 'bieden');
  if (rules.trumpMode !== 'bieden') throw new Error('Bieden staat uit');
  const min = minBidFor(state.contract, trump);
  if (min === null || value < min || value > PIT_BID || value % 10 !== 0)
    throw new Error(`Bod ${value} ${trump} mag hier niet`);
  const bid: Bid = { seat, value, trump };
  const bids = [...(state.bids ?? []), { seat, bid }];
  if (state.lastChance) return startPlay({ ...state, bids }, bid);
  return { ...state, bids, contract: bid, passes: 0, turn: nextSeat(seat) };
}

function startPlay(state: RoundState, contract: Bid): RoundState {
  const first = nextSeat(state.dealer);
  return {
    ...state,
    phase: 'spelen',
    contract,
    lastChance: false,
    trump: contract.trump,
    trumpChooser: contract.seat,
    playingTeam: teamOf(contract.seat),
    turn: first,
    currentTrick: { leader: first, cards: [] },
  };
}

export function chooseTrump(state: RoundState, rules: Rules, seat: Seat, suit: Suit): RoundState {
  assertTurn(state, seat, 'bieden');
  if (!bidOptions(state, rules).suits.includes(suit))
    throw new Error(`Troef ${suit} mag hier niet`);
  const first = nextSeat(state.dealer);
  return {
    ...state,
    phase: 'spelen',
    trump: suit,
    trumpChooser: seat,
    playingTeam: teamOf(seat),
    turn: first,
    currentTrick: { leader: first, cards: [] },
  };
}

/** Kaarten die de speler aan de beurt mag spelen (leeg buiten de speelfase). */
export function playableCards(state: RoundState, rules: Rules): Card[] {
  if (state.phase !== 'spelen' || !state.trump) return [];
  return legalCards(state.hands[state.turn]!, state.currentTrick, state.trump, rules.variant);
}

export function playCard(state: RoundState, rules: Rules, seat: Seat, card: Card): RoundState {
  assertTurn(state, seat, 'spelen');
  if (!playableCards(state, rules).some((c) => sameCard(c, card))) {
    throw new Error(`Kaart ${cardId(card)} mag niet gespeeld worden`);
  }
  const trump = state.trump!;
  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => !sameCard(c, card)) : h));
  const trick = { ...state.currentTrick, cards: [...state.currentTrick.cards, { seat, card }] };

  if (trick.cards.length < 4) return { ...state, hands, currentTrick: trick, turn: nextSeat(seat) };

  const winner = trickWinner(trick, trump);
  const isLast = state.tricks.length === 7;
  const cards = trick.cards.map((pc) => pc.card);
  const completed: CompletedTrick = {
    ...trick,
    winner,
    points: cards.reduce((sum, c) => sum + cardPoints(c, trump), 0) + (isLast ? 10 : 0),
    roem: roemOf(cards, trump, rules.trumpMode === 'bieden'),
  };
  return {
    ...state,
    hands,
    tricks: [...state.tricks, completed],
    currentTrick: { leader: winner, cards: [] },
    turn: winner,
    phase: isLast ? 'klaar' : 'spelen',
  };
}

/**
 * Telling van een gespeeld spel.
 * Pit (alle slagen) geeft +100 roem. Het spelende team moet meer dan de helft van
 * alle punten + roem halen, anders nat: de tegenpartij krijgt 162 plus alle roem.
 */
export function scoreRound(
  tricks: CompletedTrick[],
  playingTeam: Team,
  contract?: Bid | null,
): RoundScore {
  const points: Pair = [0, 0];
  const roem: Pair = [0, 0];
  for (const t of tricks) {
    const team = teamOf(t.winner);
    points[team] += t.points;
    roem[team] += t.roem;
  }

  let pit: Team | null = null;
  for (const team of [0, 1] as const) {
    if (tricks.length === 8 && tricks.every((t) => teamOf(t.winner) === team)) {
      pit = team;
      roem[team] += 100;
    }
  }

  const opp: Team = playingTeam === 0 ? 1 : 0;
  const all = points[0] + points[1] + roem[0] + roem[1];
  const own = points[playingTeam] + roem[playingTeam];
  // Bieden: je moet je bod halen (punten + roem); een pit-bod haal je alleen met een pit.
  const nat = contract
    ? contract.value >= PIT_BID
      ? pit !== playingTeam
      : own < contract.value
    : own <= all / 2;

  const total: Pair = [points[0] + roem[0], points[1] + roem[1]];
  if (nat) {
    total[playingTeam] = 0;
    // 162 (bij sans 130) plus alle roem naar de tegenpartij.
    total[opp] = (contract ? points[0] + points[1] : 162) + roem[0] + roem[1];
  }
  return { playingTeam, points, roem, nat, pit, total, ...(contract ? { contract } : {}) };
}
