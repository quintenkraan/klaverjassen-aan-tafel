import { useEffect, useRef, useState } from 'react';
import { createRng, scoreRound, teamOf, type GameState, type Seat } from '../engine';
import { nl } from '../i18n/nl';
import type { Speech } from './Avatar';

type Line = { seat: Seat; lines: readonly string[] };
const BOTS: readonly Seat[] = [1, 2, 3];

/** Bepaalt bij de laatste gebeurtenis aan tafel of iemand iets zegt (cosmetisch). */
function lineFor(game: GameState, rng: () => number): Line | null {
  const r = game.round;
  const pickBot = (team: 0 | 1 | null): Seat => {
    const options = BOTS.filter((s) => team === null || teamOf(s) === team);
    return options[Math.floor(rng() * options.length)]!;
  };

  if (r.phase === 'bieden' || (r.phase === 'klaar' && r.playingTeam === null)) {
    const turn = r.bids?.at(-1);
    if (!turn || turn.seat === 0) return null;
    if (!turn.bid) return { seat: turn.seat, lines: nl.bidding.pass };
    const say = nl.bidding.say(nl.bidding.value(turn.bid.value), nl.suits[turn.bid.trump]);
    return { seat: turn.seat, lines: [say] };
  }

  if (r.phase === 'klaar' && r.playingTeam !== null) {
    const s = scoreRound(r.tricks, r.playingTeam, r.contract);
    if (s.pit !== null) return { seat: s.pit === 0 ? 2 : pickBot(1), lines: nl.talk.pit };
    if (s.nat) {
      return r.playingTeam === 0
        ? { seat: pickBot(1), lines: nl.talk.natUs }
        : { seat: 2, lines: nl.talk.natThem };
    }
    return null;
  }

  const last = r.tricks.at(-1);
  if (r.phase === 'spelen' && !last && r.currentTrick.cards.length === 0) {
    if (r.trumpChooser && r.trump)
      return { seat: r.trumpChooser, lines: nl.talk.trump(nl.suits[r.trump]) };
    return null;
  }

  if (last && r.currentTrick.cards.length === 0) {
    const value = last.points + last.roem;
    if (last.roem > 0)
      return { seat: last.winner === 0 ? 2 : last.winner, lines: nl.talk.roem(last.roem) };
    if (last.winner !== 0 && value >= 30 && rng() < 0.5)
      return { seat: last.winner, lines: nl.talk.win };
    if (teamOf(last.winner) === 1 && value >= 30 && rng() < 0.4)
      return { seat: 2, lines: nl.talk.sigh };
    if (rng() < 0.12) return { seat: pickBot(null), lines: nl.talk.idle };
  }
  return null;
}

export function useTalk(game: GameState, seed: number): Speech | null {
  const [speech, setSpeech] = useState<Speech | null>(null);
  const rng = useRef(createRng(seed ^ 0x7a1c));
  const lastKey = useRef('');
  const r = game.round;
  const key = `${game.roundIndex}:${r.phase}:${r.trump}:${r.bids?.length ?? 0}:${r.tricks.length}:${r.currentTrick.cards.length === 0}`;

  useEffect(() => {
    if (key === lastKey.current) return;
    lastKey.current = key;
    const line = lineFor(game, rng.current);
    if (!line) return;
    const text = line.lines[Math.floor(rng.current() * line.lines.length)]!;
    setSpeech({ seat: line.seat, text, id: Date.now() });
  }, [key, game]);

  useEffect(() => {
    if (!speech) return;
    const t = setTimeout(() => setSpeech(null), 2600);
    return () => clearTimeout(t);
  }, [speech]);

  return speech;
}
