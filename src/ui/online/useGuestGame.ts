import { useEffect, useRef } from 'react';
import { isGameOver, type GameState } from '../../engine';
import type { ToHost } from '../../net/protocol';
import { useSignalFx, useTrickPause, type Action, type GameController } from '../useGame';

/**
 * Gast: het spel komt van de host (al gedraaid, jij op stoel 0). Zetten gaan terug naar de
 * host; die controleert ze. Gebaren en reacties leiden we af uit het seinlog.
 */
export function useGuestGame(
  game: GameState,
  send: (msg: ToHost) => void,
  seed: number,
): GameController {
  const pause = useTrickPause(game);
  const fx = useSignalFx(seed);
  const seen = useRef(0);

  const log = game.signals.log;
  const last = log.at(-1);
  useEffect(() => {
    if (!last || last.id === seen.current) return;
    seen.current = last.id;
    fx.showEvent(last);
    // fx is stabiel (setters en refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  const act = (action: Action) => send({ t: 'action', action });
  return {
    game,
    pause,
    over: isGameOver(game),
    gesture: fx.gesture,
    nod: fx.nod,
    line: fx.line,
    play: (card) => act({ kind: 'play', card }),
    pass: () => act({ kind: 'pass' }),
    choose: (suit) => act({ kind: 'trump', suit }),
    bid: (value, trump) => act({ kind: 'bid', value, trump }),
    signal: (gesture) => act({ kind: 'signal', gesture }),
    accuse: () => act({ kind: 'accuse' }),
    nextRound: () => act({ kind: 'next' }),
    newGame: () => act({ kind: 'restart' }),
  };
}
