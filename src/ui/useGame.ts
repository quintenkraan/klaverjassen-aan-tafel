import { useEffect, useRef, useState } from 'react';
import {
  chooseTrump,
  createGame,
  createRng,
  DEFAULT_RULES,
  finishRound,
  isGameOver,
  passBid,
  playCard,
  simpleBotStep,
  type Card,
  type GameState,
  type Suit,
} from '../engine';

const BOT_DELAY = [500, 1100] as const;
const TRICK_PAUSE = 1300;

/** Spelstatus + bots. De UI roept alleen deze acties aan; regels zitten in de engine. */
export function useGame(seed: number) {
  const [game, setGame] = useState<GameState>(() => createGame(DEFAULT_RULES, seed));
  const [pause, setPause] = useState(false);
  const botRng = useRef(createRng(seed ^ 0x5eed));
  const round = game.round;

  // Na een volle slag even laten liggen zodat je ziet wie hem pakt.
  useEffect(() => {
    if (round.tricks.length === 0) return;
    setPause(true);
    const t = setTimeout(() => setPause(false), TRICK_PAUSE);
    return () => clearTimeout(t);
  }, [round.tricks.length]);

  // Bots aan de beurt: na een wisselende bedenktijd één stap zetten.
  useEffect(() => {
    if (pause || round.turn === 0 || round.phase === 'klaar') return;
    const [min, max] = BOT_DELAY;
    const delay = min + botRng.current() * (max - min);
    const t = setTimeout(() => {
      setGame((g) =>
        g.round.turn === 0 ? g : { ...g, round: simpleBotStep(g.round, g.rules, botRng.current) },
      );
    }, delay);
    return () => clearTimeout(t);
  }, [round, pause]);

  const human = (fn: (g: GameState) => GameState['round']) =>
    setGame((g) => (g.round.turn === 0 ? { ...g, round: fn(g) } : g));

  return {
    game,
    pause,
    over: isGameOver(game),
    play: (card: Card) => human((g) => playCard(g.round, g.rules, 0, card)),
    pass: () => human((g) => passBid(g.round, g.rules, 0)),
    choose: (suit: Suit) => human((g) => chooseTrump(g.round, g.rules, 0, suit)),
    nextRound: () => setGame((g) => finishRound(g)),
    newGame: () => setGame(createGame(DEFAULT_RULES, Date.now() >>> 0)),
  };
}
