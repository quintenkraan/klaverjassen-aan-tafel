/** Publieke types van de engine. Latere fases lezen dit bestand in plaats van de hele engine. */

export type Suit = 'klaveren' | 'ruiten' | 'harten' | 'schoppen';
/** B = boer, V = vrouw, H = heer. */
export type Rank = '7' | '8' | '9' | '10' | 'B' | 'V' | 'H' | 'A';

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

/** 0 = jij (onder), 1 = links, 2 = maat (boven), 3 = rechts. Speelvolgorde 0, 1, 2, 3. */
export type Seat = 0 | 1 | 2 | 3;
/** Team = seat % 2. Team 0 = wij (jij + maat), team 1 = zij. */
export type Team = 0 | 1;
export type Pair = [number, number];

/** Amsterdams: niet hoeven troeven als je maat de slag heeft. Rotterdams: altijd troefplicht. */
export type Variant = 'amsterdams' | 'rotterdams';
/** verplicht: speler na de deler kiest troef. vrij: om de beurt kiezen of passen.
 *  utrechts: een voorgestelde kleur spelen of passen. */
export type TrumpMode = 'verplicht' | 'utrechts' | 'vrij';
export type GameLength = { kind: 'spellen'; count: number } | { kind: 'punten'; target: number };

export interface Rules {
  variant: Variant;
  trumpMode: TrumpMode;
  length: GameLength;
  signals: { enabled: boolean; penalty: SignalPenalty };
}

// ---------- Seinen ----------

export type Gesture =
  'knipoog' | 'wenkbrauw' | 'tikken' | 'rugkaart' | 'keelschrapen' | 'oorkrabben';
export type Meaning = 'troefboer' | `speel-${Suit}`;
/** Seinafspraak: welk gebaar betekent wat. */
export type Agreement = Record<Gesture, Meaning | null>;
/** Straf als je na een waarschuwing opnieuw betrapt wordt. */
export type SignalPenalty = 'punten' | 'spel';
export type Consequence = 'geen' | 'waarschuwing' | 'strafpunten' | 'spel-verbeurd';

export interface SignalEvent {
  id: number;
  from: Seat;
  to: Seat;
  gesture: Gesture;
  intended: Meaning | null;
  /** Heeft de maat het gezien (null als de maat de mens is: die moet zelf opletten). */
  seen: boolean | null;
  /** Wat de maat denkt dat het betekent (kan fout zijn). */
  understood: Meaning | null;
  caughtBy: Seat | null;
  consequence: Consequence;
  /** Moment in het spel (aantal gespeelde kaarten), voor "Ik zag dat!". */
  at: number;
  accused: boolean;
}

export interface SignalState {
  agreement: Agreement;
  /** Geheime afspraak van Tante Ria en Sjaak. */
  opponentAgreement: Agreement;
  /** 0..1, groeit met elk sein, halveert per spel. */
  suspicion: number;
  warned: [boolean, boolean];
  /** Gebaren van jullie die de tegenstanders doorhebben. */
  known: Gesture[];
  /** Hoe vaak jullie een gebaar gebruikten: hoe vaker, hoe beter Henk het begrijpt. */
  usage: Partial<Record<Gesture, number>>;
  /** Per stoel: wat die speler denkt dat zijn maat dit spel heeft geseind. */
  beliefs: (Meaning | null)[];
  /** Strafpunten dit spel, per team dat ze krijgt. */
  penalties: Pair;
  /** Team dat dit spel verbeurd heeft. */
  forfeit: Team | null;
  log: SignalEvent[];
  nextId: number;
}

export interface PlayedCard {
  seat: Seat;
  card: Card;
}

export interface Trick {
  leader: Seat;
  cards: PlayedCard[];
}

export interface CompletedTrick extends Trick {
  winner: Seat;
  /** Kaartpunten, inclusief +10 voor de laatste slag. */
  points: number;
  roem: number;
}

export type Phase = 'bieden' | 'spelen' | 'klaar';

export interface RoundState {
  dealer: Seat;
  hands: Card[][];
  phase: Phase;
  turn: Seat;
  trump: Suit | null;
  trumpChooser: Seat | null;
  playingTeam: Team | null;
  /** Alleen bij utrechts: de voorgestelde troefkleur. */
  proposedSuit: Suit | null;
  passes: number;
  currentTrick: Trick;
  tricks: CompletedTrick[];
}

export interface BidOptions {
  canPass: boolean;
  suits: Suit[];
}

export interface RoundScore {
  playingTeam: Team;
  points: Pair;
  /** Roem inclusief eventuele pit-bonus. */
  roem: Pair;
  nat: boolean;
  pit: Team | null;
  /** Wat er op het scoreblok komt. */
  total: Pair;
  /** Spel verbeurd door seinen. */
  forfeit?: Team;
  /** Strafpunten door seinen, per team dat ze kreeg. */
  penalty?: Pair;
}

export interface GameState {
  rules: Rules;
  seed: number;
  roundIndex: number;
  scores: RoundScore[];
  round: RoundState;
  signals: SignalState;
}
