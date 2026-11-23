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
  playCard,
  sendSignal,
  teamOf,
  type Agreement,
  type Card,
  type Difficulty,
  type GameState,
  type Gesture,
  type Rules,
  type Seat,
  type SignalEvent,
  type Suit,
} from '../engine';
import { nl } from '../i18n/nl';
import type { Speech } from './Avatar';
import { sound } from './sound';

const TRICK_PAUSE = 1400;
const GESTURE_TIME = 1400;
/** Wordt in F7 een instelling. */
const DIFFICULTY: Difficulty = 'gemiddeld';

export interface GestureAnim {
  seat: Seat;
  gesture: Gesture;
  id: number;
}

const attention = (seat: Seat) => (seat === 0 ? 0 : PERSONALITIES[seat].attention);

/** Bedenktijd: soms vlot, soms even twijfelen. */
function thinkTime(rng: () => number, bidding: boolean): number {
  const base = bidding ? 900 : 550;
  return base + rng() * 700 + (rng() < 0.15 ? 900 : 0);
}

/** Spelstatus, bots en seinen. De UI roept alleen deze acties aan; regels zitten in de engine. */
export function useGame(seed: number, rules: Rules, agreement: Agreement) {
  const [game, setGame] = useState<GameState>(() => createGame(rules, seed, 3, agreement));
  const [ackedKey, setAckedKey] = useState('');
  const [gesture, setGesture] = useState<GestureAnim | null>(null);
  const [nod, setNod] = useState(false);
  const [line, setLine] = useState<Speech | null>(null);
  const gameRef = useRef(game);
  const botRng = useRef(createRng(seed ^ 0x5eed));
  const sigRng = useRef(createRng(seed ^ 0x51c));
  const ids = useRef(1);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const round = game.round;
  const trickKey = `${game.roundIndex}:${round.tricks.length}`;
  const pause = round.tricks.length > 0 && ackedKey !== trickKey;

  useEffect(() => {
    if (!pause) return;
    const t = setTimeout(() => setAckedKey(trickKey), TRICK_PAUSE);
    return () => clearTimeout(t);
  }, [pause, trickKey]);

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
    const text = lines[Math.floor(sigRng.current() * lines.length)]!;
    setLine({ seat, text, id: Date.now() + ids.current++ });
  };

  /** Laat een sein zien (gebaar, knik van Henk, reactie als iemand het zag). */
  const showEvent = (e: SignalEvent) => {
    setGesture({ seat: e.from, gesture: e.gesture, id: ids.current++ });
    if (e.gesture === 'tikken') sound.knock();
    if (e.from === 0 && e.seen) setTimeout(() => setNod(true), 500);
    if (e.caughtBy !== null) {
      say(
        e.caughtBy,
        e.consequence === 'waarschuwing' ? nl.talk.caughtWarn : nl.talk.caughtPenalty,
      );
    }
  };

  // Bots: eventueel eerst seinen, daarna (volgende tik) een zet.
  useEffect(() => {
    if (pause || round.turn === 0 || round.phase === 'klaar') return;
    const t = setTimeout(
      () => {
        const g = gameRef.current;
        const seat = g.round.turn;
        if (seat === 0 || g.round.phase === 'klaar') return;
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
            );
            setGame({ ...g, signals: state });
            showEvent(event);
            return;
          }
        }
        const hint = g.signals.beliefs[seat] ?? null;
        setGame({ ...g, round: botStep(g.round, g.rules, botRng.current, DIFFICULTY, hint) });
      },
      thinkTime(botRng.current, round.phase === 'bieden'),
    );
    return () => clearTimeout(t);
    // showEvent is stabiel genoeg: alleen setters en refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, pause]);

  const human = (fn: (g: GameState) => GameState['round']) => {
    const g = gameRef.current;
    if (g.round.turn !== 0 || pause) return;
    const next = { ...g, round: fn(g) };
    gameRef.current = next;
    setGame(next);
  };

  const signal = (gesture: Gesture) => {
    const g = gameRef.current;
    if (!g.rules.signals.enabled || g.round.phase !== 'spelen') return;
    const { state, event } = sendSignal(
      g.signals,
      g.round,
      g.rules,
      0,
      gesture,
      sigRng.current,
      attention,
    );
    const next = { ...g, signals: state };
    gameRef.current = next;
    setGame(next);
    showEvent(event);
  };

  const accuse = () => {
    const g = gameRef.current;
    const res = accuseEngine(g.signals, g.round, g.rules, 0);
    const next = { ...g, signals: res.state };
    gameRef.current = next;
    setGame(next);
    if (res.correct && res.accused !== null) say(res.accused, nl.talk.busted);
    else say(sigRng.current() < 0.5 ? 1 : 3, nl.talk.deny);
  };

  return {
    game,
    pause,
    over: isGameOver(game),
    gesture,
    nod,
    line,
    play: (card: Card) => human((g) => playCard(g.round, g.rules, 0, card)),
    pass: () => human((g) => passBid(g.round, g.rules, 0)),
    choose: (suit: Suit) => human((g) => chooseTrump(g.round, g.rules, 0, suit)),
    signal,
    accuse,
    nextRound: () => setGame((g) => finishRound(g)),
    newGame: () => setGame(createGame(rules, Date.now() >>> 0, 3, agreement)),
    teamOfSeat: teamOf,
  };
}
