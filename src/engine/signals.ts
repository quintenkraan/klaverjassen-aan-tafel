import type { Personality } from './ai/profile';
import { partnerOf, SUITS, teamOf } from './cards';
import { shuffle, type Rng } from './rng';
import type {
  Agreement,
  Consequence,
  Gesture,
  Meaning,
  Pair,
  RoundScore,
  RoundState,
  Rules,
  Seat,
  SignalEvent,
  SignalState,
  Team,
} from './types';

export const GESTURES: readonly Gesture[] = [
  'knipoog',
  'wenkbrauw',
  'tikken',
  'rugkaart',
  'keelschrapen',
  'oorkrabben',
];
export const MEANINGS: readonly Meaning[] = [
  'troefboer',
  ...SUITS.map((s) => `speel-${s}` as const),
];

/** visibility: kans dat je maat het ziet. conspicuous: kans dat een tegenstander het opvalt. */
export const GESTURE_INFO: Record<Gesture, { visibility: number; conspicuous: number }> = {
  knipoog: { visibility: 0.7, conspicuous: 0.3 },
  wenkbrauw: { visibility: 0.6, conspicuous: 0.2 },
  tikken: { visibility: 0.9, conspicuous: 0.55 },
  rugkaart: { visibility: 0.75, conspicuous: 0.4 },
  keelschrapen: { visibility: 0.85, conspicuous: 0.45 },
  oorkrabben: { visibility: 0.55, conspicuous: 0.15 },
};

export const DEFAULT_AGREEMENT: Agreement = {
  knipoog: 'troefboer',
  wenkbrauw: 'speel-harten',
  tikken: 'speel-klaveren',
  rugkaart: null,
  keelschrapen: 'speel-schoppen',
  oorkrabben: 'speel-ruiten',
};

export const PENALTY_POINTS = 50;
export const FALSE_ACCUSATION_POINTS = 25;
const SUSPICION_STEP = 0.15;

export function createSignalState(agreement: Agreement, rng: Rng): SignalState {
  const opponentAgreement = Object.fromEntries(GESTURES.map((g) => [g, null])) as Agreement;
  shuffle(GESTURES, rng)
    .slice(0, MEANINGS.length)
    .forEach((g, i) => (opponentAgreement[g] = MEANINGS[i]!));
  return {
    agreement: { ...agreement },
    opponentAgreement,
    suspicion: 0,
    warned: [false, false],
    known: [],
    usage: {},
    beliefs: [null, null, null, null],
    penalties: [0, 0],
    forfeit: null,
    log: [],
    nextId: 1,
  };
}

/** Nieuw spel: overtuigingen en straffen weg, achterdocht zakt half weg. */
export function resetForRound(s: SignalState): SignalState {
  return {
    ...s,
    suspicion: s.suspicion * 0.5,
    beliefs: [null, null, null, null],
    penalties: [0, 0],
    forfeit: null,
    log: [],
  };
}

export function moveIndex(round: RoundState): number {
  return round.tricks.length * 4 + round.currentTrick.cards.length;
}

function punish(
  s: SignalState,
  team: Team,
  rules: Rules,
  gesture?: Gesture,
): { state: SignalState; consequence: Consequence } {
  let state: SignalState;
  let consequence: Consequence;
  if (!s.warned[team]) {
    const warned: [boolean, boolean] = [...s.warned];
    warned[team] = true;
    state = { ...s, warned };
    consequence = 'waarschuwing';
  } else if (rules.signals.penalty === 'spel') {
    state = { ...s, forfeit: team };
    consequence = 'spel-verbeurd';
  } else {
    const penalties: Pair = [...s.penalties];
    penalties[team === 0 ? 1 : 0] += PENALTY_POINTS;
    state = { ...s, penalties };
    consequence = 'strafpunten';
  }
  if (team === 0 && gesture && !state.known.includes(gesture)) {
    state = { ...state, known: [...state.known, gesture] };
  }
  return { state, consequence };
}

/**
 * Een speler seint naar zijn maat. Drie kansen: maat ziet het, maat begrijpt het,
 * tegenstander betrapt het. De mens als ontvanger moet het zelf zien (seen = null),
 * de mens als tegenstander betrapt via accuse().
 */
export function sendSignal(
  s: SignalState,
  round: RoundState,
  rules: Rules,
  from: Seat,
  gesture: Gesture,
  rng: Rng,
  attention: (seat: Seat) => number,
): { state: SignalState; event: SignalEvent } {
  const team = teamOf(from);
  const to = partnerOf(from);
  const intended = (team === 0 ? s.agreement : s.opponentAgreement)[gesture];
  const info = GESTURE_INFO[gesture];

  let seen: boolean | null = null;
  let understood: Meaning | null = null;
  const beliefs = [...s.beliefs];
  if (to !== 0) {
    seen = rng() < info.visibility * (0.5 + 0.5 * attention(to));
    if (seen && intended) {
      const uses = team === 0 ? (s.usage[gesture] ?? 0) : 3;
      const familiarity = Math.min(0.95, 0.7 + 0.05 * uses);
      const others = MEANINGS.filter((m) => m !== intended);
      understood = rng() < familiarity ? intended : others[Math.floor(rng() * others.length)]!;
      beliefs[to] = understood;
    }
  }

  let state: SignalState = {
    ...s,
    beliefs,
    suspicion: Math.min(1, s.suspicion + SUSPICION_STEP),
    usage: team === 0 ? { ...s.usage, [gesture]: (s.usage[gesture] ?? 0) + 1 } : s.usage,
    nextId: s.nextId + 1,
  };

  let caughtBy: Seat | null = null;
  const known = team === 0 && s.known.includes(gesture);
  for (const o of [1, 2, 3] as const) {
    if (teamOf(o) === team) continue;
    const p = Math.min(
      0.9,
      info.conspicuous * attention(o) * (1 + s.suspicion) * (known ? 1.6 : 1),
    );
    if (rng() < p) {
      caughtBy = o;
      break;
    }
  }

  let consequence: Consequence = 'geen';
  if (caughtBy !== null) ({ state, consequence } = punish(state, team, rules, gesture));

  const event: SignalEvent = {
    id: s.nextId,
    from,
    to,
    gesture,
    intended,
    seen,
    understood,
    caughtBy,
    consequence,
    at: moveIndex(round),
    accused: caughtBy !== null,
  };
  return { state: { ...state, log: [...state.log, event] }, event };
}

/**
 * "Ik zag dat!": terecht als de tegenpartij in deze of de vorige zet seinde.
 * Onterecht kost FALSE_ACCUSATION_POINTS voor de tegenpartij.
 */
export function accuse(
  s: SignalState,
  round: RoundState,
  rules: Rules,
  accuser: Seat,
): { state: SignalState; correct: boolean; consequence: Consequence; accused: Seat | null } {
  const team = teamOf(accuser);
  const now = moveIndex(round);
  let idx = -1;
  for (let i = s.log.length - 1; i >= 0; i--) {
    const e = s.log[i]!;
    if (teamOf(e.from) !== team && !e.accused && e.at >= now - 1) {
      idx = i;
      break;
    }
  }
  if (idx >= 0) {
    const e = s.log[idx]!;
    const log = s.log.map((x, i) => (i === idx ? { ...x, accused: true } : x));
    const r = punish({ ...s, log }, teamOf(e.from), rules);
    return { state: r.state, correct: true, consequence: r.consequence, accused: e.from };
  }
  const penalties: Pair = [...s.penalties];
  penalties[team === 0 ? 1 : 0] += FALSE_ACCUSATION_POINTS;
  return { state: { ...s, penalties }, correct: false, consequence: 'strafpunten', accused: null };
}

/** Verwerkt verbeurd spel en strafpunten in de telling van een spel. */
export function applySignalPenalties(score: RoundScore, s: SignalState): RoundScore {
  const total: Pair = [...score.total];
  if (s.forfeit !== null) {
    total[s.forfeit] = 0;
    total[s.forfeit === 0 ? 1 : 0] = 162 + score.roem[0] + score.roem[1];
  }
  total[0] += s.penalties[0];
  total[1] += s.penalties[1];
  return {
    ...score,
    total,
    ...(s.forfeit !== null && { forfeit: s.forfeit }),
    ...((s.penalties[0] > 0 || s.penalties[1] > 0) && { penalty: [...s.penalties] as Pair }),
  };
}

/** Wil deze bot nu seinen, en zo ja met welk gebaar? Hooguit één keer per spel. */
export function botSignalIntent(
  round: RoundState,
  seat: Seat,
  personality: Personality,
  s: SignalState,
  rng: Rng,
): Gesture | null {
  if (round.phase !== 'spelen' || !round.trump) return null;
  if (s.log.some((e) => e.from === seat)) return null;
  const team = teamOf(seat);
  const eagerness = personality.signalTendency * (team === 1 ? 1 - personality.honesty : 1) * 0.35;
  if (rng() >= eagerness * (1 - s.suspicion * 0.6)) return null;

  const hand = round.hands[seat]!;
  let meaning: Meaning | null = null;
  if (hand.some((c) => c.suit === round.trump && c.rank === 'B')) meaning = 'troefboer';
  else {
    const ace = hand.find((c) => c.rank === 'A' && c.suit !== round.trump);
    if (ace) meaning = `speel-${ace.suit}`;
  }
  if (!meaning) return null;
  const agreement = team === 0 ? s.agreement : s.opponentAgreement;
  return GESTURES.find((g) => agreement[g] === meaning) ?? null;
}
