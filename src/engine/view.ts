import type {
  Agreement,
  Card,
  CompletedTrick,
  GameState,
  Pair,
  RoundScore,
  RoundState,
  Seat,
  SignalState,
  Team,
  Trick,
} from './types';

/**
 * Multiplayer: elke speler ziet het spel alsof hij zelf op stoel 0 zit (de UI gaat daar
 * vanuit). viewFor draait het hele spel zodat `me` stoel 0 wordt en verbergt wat je niet
 * mag zien: andermans kaarten en de geheime seinafspraak van de tegenpartij.
 */

/** Absolute stoel -> stoel zoals `me` hem ziet. */
export function toView(seat: Seat, me: Seat): Seat {
  return ((seat - me + 4) % 4) as Seat;
}

/** Stoel zoals `me` hem ziet -> absolute stoel. */
export function fromView(seat: Seat, me: Seat): Seat {
  return ((seat + me) % 4) as Seat;
}

const teamView = (t: Team, me: Seat): Team => (me % 2 === 0 ? t : ((1 - t) as Team));
const pairView = (p: Pair, me: Seat): Pair => (me % 2 === 0 ? [...p] : [p[1], p[0]]);

/** Plaatsvervanger voor een kaart die je niet mag zien. */
export const HIDDEN_CARD: Card = { suit: 'klaveren', rank: '7' };

function trickView<T extends Trick>(t: T, me: Seat): T {
  return {
    ...t,
    leader: toView(t.leader, me),
    cards: t.cards.map((pc) => ({ ...pc, seat: toView(pc.seat, me) })),
  };
}

function roundView(r: RoundState, me: Seat, reveal: boolean): RoundState {
  const hands = [0, 1, 2, 3].map((i) => {
    const abs = fromView(i as Seat, me);
    const hand = r.hands[abs]!;
    return abs === me || reveal ? [...hand] : hand.map(() => HIDDEN_CARD);
  });
  return {
    ...r,
    hands,
    dealer: toView(r.dealer, me),
    turn: toView(r.turn, me),
    trumpChooser: r.trumpChooser === null ? null : toView(r.trumpChooser, me),
    playingTeam: r.playingTeam === null ? null : teamView(r.playingTeam, me),
    currentTrick: trickView(r.currentTrick, me),
    tricks: r.tricks.map((t) => ({
      ...trickView<CompletedTrick>(t, me),
      winner: toView(t.winner, me),
    })),
  };
}

function scoreView(s: RoundScore, me: Seat): RoundScore {
  return {
    ...s,
    playingTeam: teamView(s.playingTeam, me),
    points: pairView(s.points, me),
    roem: pairView(s.roem, me),
    total: pairView(s.total, me),
    pit: s.pit === null ? null : teamView(s.pit, me),
    ...(s.forfeit !== undefined && { forfeit: teamView(s.forfeit, me) }),
    ...(s.penalty !== undefined && { penalty: pairView(s.penalty, me) }),
  };
}

const NO_AGREEMENT: Agreement = {
  knipoog: null,
  wenkbrauw: null,
  tikken: null,
  rugkaart: null,
  keelschrapen: null,
  oorkrabben: null,
};

function signalsView(s: SignalState, me: Seat): SignalState {
  const myTeamIsZero = me % 2 === 0;
  return {
    ...s,
    // In de view is "jouw team" altijd team 0, met jouw afspraak; die van de anderen blijft geheim.
    agreement: { ...(myTeamIsZero ? s.agreement : s.opponentAgreement) },
    opponentAgreement: { ...NO_AGREEMENT },
    warned: pairView(s.warned as unknown as Pair, me) as unknown as [boolean, boolean],
    penalties: pairView(s.penalties, me),
    forfeit: s.forfeit === null ? null : teamView(s.forfeit, me),
    // Alleen je eigen overtuiging; wat anderen denken weet je niet.
    beliefs: [s.beliefs[me] ?? null, null, null, null],
    log: s.log.map((e) => ({
      ...e,
      from: toView(e.from, me),
      to: toView(e.to, me),
      caughtBy: e.caughtBy === null ? null : toView(e.caughtBy, me),
      // Wat een ander bedoelde of begreep, blijft verborgen (behalve bij je eigen seinen).
      intended: e.from === me || (e.from % 2 === me % 2 && e.to === me) ? e.intended : null,
      understood: e.from === me ? e.understood : null,
    })),
  };
}

/**
 * Het spel zoals speler `me` het mag zien, gedraaid zodat `me` stoel 0 is.
 * `reveal` toont alle kaarten (alleen voor tests en de host-debugger).
 */
export function viewFor(game: GameState, me: Seat, reveal = false): GameState {
  return {
    ...game,
    round: roundView(game.round, me, reveal),
    scores: game.scores.map((s) => scoreView(s, me)),
    signals: signalsView(game.signals, me),
  };
}
