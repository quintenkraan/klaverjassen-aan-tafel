import { useEffect, useRef, useState } from 'react';
import {
  accuse as accuseEngine,
  botSignalIntent,
  botStep,
  chooseTrump,
  createGame,
  createRng,
  finishRound,
  isGameOver,
  passBid,
  PERSONALITIES,
  placeBid,
  playCard,
  sendSignal,
  type Card,
  type GameState,
  type Gesture,
  type Seat,
  type SignalEvent,
  type Suit,
  type Trump,
} from '../engine';
import { nl } from '../i18n/nl';
import type { Speech } from './Avatar';
import { sound } from './sound';
import { clearGame, saveGame, type TableConfig } from './storage';

const TRICK_PAUSE = 1400;
const GESTURE_TIME = 1400;

export interface GestureAnim {
  seat: Seat;
  gesture: Gesture;
  id: number;
}

/** Een zet van een speler (ook van een gast via het netwerk). */
export type Action =
  | { kind: 'play'; card: Card }
  | { kind: 'pass' }
  | { kind: 'trump'; suit: Suit }
  | { kind: 'bid'; value: number; trump: Trump }
  | { kind: 'signal'; gesture: Gesture }
  | { kind: 'accuse' }
  | { kind: 'next' }
  | { kind: 'restart' };

/** Wat de tafel-UI nodig heeft, ongeacht of je alleen speelt, host bent of gast. */
export interface GameController {
  game: GameState;
  pause: boolean;
  over: boolean;
  gesture: GestureAnim | null;
  nod: boolean;
  line: Speech | null;
  play: (card: Card) => void;
  pass: () => void;
  choose: (suit: Suit) => void;
  /** Bieden: een bod op een troef (of sans). */
  bid: (value: number, trump: Trump) => void;
  signal: (gesture: Gesture) => void;
  accuse: () => void;
  nextRound: () => void;
  newGame: () => void;
  /** Alleen bij online spelen: wie er aan tafel zit (null = bot). */
  names?: (string | null)[];
}

/** Bedenktijd: soms vlot, soms even twijfelen. */
function thinkTime(rng: () => number, bidding: boolean): number {
  const base = bidding ? 900 : 550;
  return base + rng() * 700 + (rng() < 0.15 ? 900 : 0);
}

/** Pauze na een volle slag, afgeleid uit de state (geen flikkering). Ook gebruikt door gasten. */
export function useTrickPause(game: GameState): boolean {
  const [ackedKey, setAckedKey] = useState('');
  const trickKey = `${game.roundIndex}:${game.round.tricks.length}`;
  const pause = game.round.tricks.length > 0 && ackedKey !== trickKey;
  useEffect(() => {
    if (!pause) return;
    const t = setTimeout(() => setAckedKey(trickKey), TRICK_PAUSE);
    return () => clearTimeout(t);
  }, [pause, trickKey]);
  return pause;
}

/** Gebaren, knikken en tafelpraat bij seinen. Ook gebruikt door gasten (vanuit het seinlog). */
export function useSignalFx(seed: number) {
  const [gesture, setGesture] = useState<GestureAnim | null>(null);
  const [nod, setNod] = useState(false);
  const [line, setLine] = useState<Speech | null>(null);
  const rng = useRef(createRng(seed ^ 0x51c0));
  const ids = useRef(1);

  useEffect(() => {
    if (!gesture) return;
    const t = setTimeout(() => setGesture(null), GESTURE_TIME);
    return () => clearTimeout(t);
  }, [gesture]);
  useEffect(() => {
    if (!nod) return;
    const t = setTimeout(() => setNod(false), 1000);
    return () => clearTimeout(t);
  }, [nod]);

  const say = (seat: Seat, lines: readonly string[]) => {
    const text = lines[Math.floor(rng.current() * lines.length)]!;
    setLine({ seat, text, id: Date.now() + ids.current++ });
  };

  /** Laat een sein zien (gebaar, knik van je maat, reactie als iemand het zag). Stoelen in view. */
  const showEvent = (e: SignalEvent) => {
    setGesture({ seat: e.from, gesture: e.gesture, id: ids.current++ });
    if (e.gesture === 'tikken') sound.knock();
    if (e.from === 0 && e.seen) setTimeout(() => setNod(true), 500);
    if (e.caughtBy !== null && e.caughtBy !== 0) {
      say(
        e.caughtBy,
        e.consequence === 'waarschuwing' ? nl.talk.caughtWarn : nl.talk.caughtPenalty,
      );
    }
  };

  return { gesture, nod, line, say, showEvent, rng };
}

export interface UseGameOptions {
  /** Stoelen met een mens (absoluut). Standaard alleen jij: [0]. Bots spelen de rest. */
  humans?: Seat[];
  /** Potje bewaren in de browser (niet bij online spelen). */
  persist?: boolean;
}

/**
 * Spelstatus, bots en seinen. De UI roept alleen deze acties aan; regels zitten in de engine.
 * Bij online spelen draait dit bij de host; gasten sturen hun zetten via `apply`.
 */
export function useGame(
  seed: number,
  config: TableConfig,
  initial?: GameState,
  options: UseGameOptions = {},
) {
  const { rules, agreement, difficulty } = config;
  const humans = options.humans ?? [0];
  const persist = options.persist ?? true;
  const [game, setGame] = useState<GameState>(
    () => initial ?? createGame(rules, seed, 3, agreement),
  );
  const gameRef = useRef(game);
  const humansRef = useRef(humans);
  humansRef.current = humans;
  const botRng = useRef(createRng(seed ^ 0x5eed));
  const sigRng = useRef(createRng(seed ^ 0x51c));
  const fx = useSignalFx(seed);
  const pause = useTrickPause(game);
  const round = game.round;

  const attention = (seat: Seat) =>
    humansRef.current.includes(seat) || seat === 0 ? 0 : PERSONALITIES[seat].attention;

  // Bijhouden voor timers, en het potje bewaren zodat je later verder kunt.
  useEffect(() => {
    gameRef.current = game;
    if (!persist) return;
    if (isGameOver(game)) clearGame();
    else saveGame({ version: 1, game, config });
  }, [game, config, persist]);

  const commit = (next: GameState) => {
    gameRef.current = next;
    setGame(next);
  };

  // Ingepast (niemand bood): even laten zien, dan deelt de volgende opnieuw.
  useEffect(() => {
    if (round.phase !== 'klaar' || round.playingTeam !== null) return;
    const t = setTimeout(() => commit(finishRound(gameRef.current)), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // Bots: eventueel eerst seinen, daarna (volgende tik) een zet.
  useEffect(() => {
    if (pause || humans.includes(round.turn) || round.phase === 'klaar') return;
    const t = setTimeout(
      () => {
        const g = gameRef.current;
        const seat = g.round.turn;
        if (seat === 0 || humansRef.current.includes(seat) || g.round.phase === 'klaar') return;
        if (g.rules.signals.enabled) {
          const wish = botSignalIntent(
            g.round,
            seat,
            PERSONALITIES[seat],
            g.signals,
            sigRng.current,
          );
          if (wish) {
            const { state, event } = sendSignal(
              g.signals,
              g.round,
              g.rules,
              seat,
              wish,
              sigRng.current,
              attention,
              humansRef.current,
            );
            commit({ ...g, signals: state });
            fx.showEvent(event);
            return;
          }
        }
        const hint = g.signals.beliefs[seat] ?? null;
        commit({ ...g, round: botStep(g.round, g.rules, botRng.current, difficulty, hint) });
      },
      thinkTime(botRng.current, round.phase === 'bieden'),
    );
    return () => clearTimeout(t);
    // fx en commit zijn stabiel genoeg: alleen setters en refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, pause, humans.join(',')]);

  /** Voer een zet uit namens `seat` (absoluut). Ongeldige of te vroege zetten worden genegeerd. */
  const apply = (seat: Seat, action: Action) => {
    const g = gameRef.current;
    const myTurn = g.round.turn === seat && !pause;
    try {
      switch (action.kind) {
        case 'play':
          if (myTurn) commit({ ...g, round: playCard(g.round, g.rules, seat, action.card) });
          break;
        case 'pass':
          if (myTurn) commit({ ...g, round: passBid(g.round, g.rules, seat) });
          break;
        case 'trump':
          if (myTurn) commit({ ...g, round: chooseTrump(g.round, g.rules, seat, action.suit) });
          break;
        case 'bid':
          if (myTurn)
            commit({
              ...g,
              round: placeBid(g.round, g.rules, seat, action.value, action.trump),
            });
          break;
        case 'signal': {
          if (!g.rules.signals.enabled || g.round.phase !== 'spelen') break;
          const { state, event } = sendSignal(
            g.signals,
            g.round,
            g.rules,
            seat,
            action.gesture,
            sigRng.current,
            attention,
            humansRef.current,
          );
          commit({ ...g, signals: state });
          fx.showEvent(event);
          break;
        }
        case 'accuse': {
          const res = accuseEngine(g.signals, g.round, g.rules, seat);
          commit({ ...g, signals: res.state });
          if (seat === 0) {
            if (res.correct && res.accused !== null) fx.say(res.accused, nl.talk.busted);
            else fx.say(fx.rng.current() < 0.5 ? 1 : 3, nl.talk.deny);
          }
          break;
        }
        case 'next':
          if (g.round.phase === 'klaar' && !isGameOver(g)) commit(finishRound(g));
          break;
        case 'restart':
          if (isGameOver(g)) commit(createGame(rules, Date.now() >>> 0, 3, agreement));
          break;
      }
    } catch {
      // Ongeldige zet (bijvoorbeeld een kaart die niet mag): negeren.
    }
  };

  const controller: GameController = {
    game,
    pause,
    over: isGameOver(game),
    gesture: fx.gesture,
    nod: fx.nod,
    line: fx.line,
    play: (card) => apply(0, { kind: 'play', card }),
    pass: () => apply(0, { kind: 'pass' }),
    choose: (suit) => apply(0, { kind: 'trump', suit }),
    bid: (value, trump) => apply(0, { kind: 'bid', value, trump }),
    signal: (gesture) => apply(0, { kind: 'signal', gesture }),
    accuse: () => apply(0, { kind: 'accuse' }),
    nextRound: () => apply(0, { kind: 'next' }),
    newGame: () => commit(createGame(rules, Date.now() >>> 0, 3, agreement)),
  };
  return { ...controller, apply };
}
