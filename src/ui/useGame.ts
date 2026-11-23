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
  botStep,
  type Difficulty,
  type Card,
  type GameState,
  type Suit,
} from '../engine';

const TRICK_PAUSE = 1400;
/** Wordt in F7 een instelling. */
const DIFFICULTY: Difficulty = 'gemiddeld';

/** Bedenktijd: soms vlot, soms even twijfelen. */
function thinkTime(rng: () => number, bidding: boolean): number {
  const base = bidding ? 900 : 550;
  return base + rng() * 700 + (rng() < 0.15 ? 900 : 0);
}

/** Spelstatus + bots. De UI roept alleen deze acties aan; regels zitten in de engine. */
export function useGame(seed: number) {
  const [game, setGame] = useState<GameState>(() => createGame(DEFAULT_RULES, seed));
  const [ackedKey, setAckedKey] = useState('');
  const botRng = useRef(createRng(seed ^ 0x5eed));
  const round = game.round;

  // Na een volle slag blijft hij even liggen. Afgeleid i.p.v. apart gezet: geen flikkering.
  const trickKey = `${game.roundIndex}:${round.tricks.length}`;
  const pause = round.tricks.length > 0 && ackedKey !== trickKey;

  useEffect(() => {
    if (!pause) return;
    const t = setTimeout(() => setAckedKey(trickKey), TRICK_PAUSE);
    return () => clearTimeout(t);
  }, [pause, trickKey]);

  useEffect(() => {
    if (pause || round.turn === 0 || round.phase === 'klaar') return;
    const t = setTimeout(
      () =>
        setGame((g) =>
          g.round.turn === 0
            ? g
            : { ...g, round: botStep(g.round, g.rules, botRng.current, DIFFICULTY) },
        ),
      thinkTime(botRng.current, round.phase === 'bieden'),
    );
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
