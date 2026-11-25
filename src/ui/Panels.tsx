import type { ReactNode } from 'react';
import {
  applySignalPenalties,
  roundTens,
  scoreRound,
  teamOf,
  totals,
  type CompletedTrick,
  type GameState,
} from '../engine';
import { nl } from '../i18n/nl';
import { CardView } from './CardView';
import { playerName } from './names';

export function ScoreSheet({
  game,
  children,
  hidden = false,
}: {
  game: GameState;
  children?: ReactNode;
  hidden?: boolean;
}) {
  const sum = totals(game);
  return (
    <aside className={hidden ? 'sheet sr-only' : 'sheet'}>
      <h2>{nl.scoreSheet}</h2>
      <table>
        <thead>
          <tr>
            <th>{nl.round}</th>
            <th>{nl.teams[0]}</th>
            <th>{nl.teams[1]}</th>
          </tr>
        </thead>
        <tbody>
          {game.scores.map((s, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {([0, 1] as const).map((t) => (
                <td key={t}>
                  {s.total[t]}
                  {s.nat && s.playingTeam === t && ` ${nl.nat}`}
                  {s.pit === t && ` ${nl.pit}`}
                  {(s.forfeit === t || (s.penalty?.[t] ?? 0) > 0) && ' *'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>{nl.total}</th>
            <th>{sum[0]}</th>
            <th>{sum[1]}</th>
          </tr>
        </tfoot>
      </table>
      {children}
    </aside>
  );
}

export function RoundOverlay({ game, onNext }: { game: GameState; onNext: () => void }) {
  const r = game.round;
  const s = applySignalPenalties(scoreRound(r.tricks, r.playingTeam!, r.contract), game.signals);
  const auction = game.rules.trumpMode === 'bieden';
  return (
    <div className="overlay">
      <h2>
        {nl.roundOver}
        {s.nat && ` ${nl.nat}`}
        {s.pit !== null && ` ${nl.pit}`}
      </h2>
      <p>
        {nl.trump} {nl.suits[r.trump!]}, {nl.plays}: {nl.teams[teamOf(r.trumpChooser!)]}
        {r.contract && ` (${nl.bidding.value(r.contract.value)})`}
      </p>
      <table>
        <thead>
          <tr>
            <th />
            <th>{nl.teams[0]}</th>
            <th>{nl.teams[1]}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{nl.points}</td>
            <td>{s.points[0]}</td>
            <td>{s.points[1]}</td>
          </tr>
          <tr>
            <td>{nl.roem}</td>
            <td>{s.roem[0]}</td>
            <td>{s.roem[1]}</td>
          </tr>
          <tr>
            <th>{nl.total}</th>
            <th>{s.total[0]}</th>
            <th>{s.total[1]}</th>
          </tr>
          {auction && (
            <tr>
              <th>{nl.onSheet}</th>
              <th>{roundTens(s.total[0])}</th>
              <th>{roundTens(s.total[1])}</th>
            </tr>
          )}
        </tbody>
      </table>
      {s.forfeit !== undefined && <p className="penalty">{nl.forfeit(nl.teams[s.forfeit])}</p>}
      {s.penalty?.map(
        (n, t) =>
          n > 0 && (
            <p key={t} className="penalty">
              {nl.penaltyNote(nl.teams[t]!, n)}
            </p>
          ),
      )}
      <button type="button" onClick={onNext} autoFocus>
        {nl.nextRound}
      </button>
    </div>
  );
}

export function GameOverOverlay({ game, onAgain }: { game: GameState; onAgain: () => void }) {
  const sum = totals(game);
  return (
    <div className="overlay">
      <h2>{nl.gameOver}</h2>
      <p>
        {nl.teams[0]} {sum[0]} - {sum[1]} {nl.teams[1]}
      </p>
      <p>{sum[0] === sum[1] ? nl.draw : nl.winner(nl.teams[sum[0] > sum[1] ? 0 : 1])}</p>
      <button type="button" onClick={onAgain} autoFocus>
        {nl.playAgain}
      </button>
    </div>
  );
}

/** Hulp voor beginners: gebaren die de bots dit spel maakten. Henks betekenis volgt jullie afspraak. */
export function SignalLog({ game }: { game: GameState }) {
  const events = game.signals.log.filter((e) => e.from !== 0).slice(-6);
  return (
    <div className="siglog">
      <h3>{nl.signalLog}</h3>
      {events.length === 0 && <p>-</p>}
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            {playerName(e.from)}: {nl.gestures[e.gesture].toLowerCase()}
            {e.from === 2 && e.intended && ` (${nl.meaning(e.intended).toLowerCase()})`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LastTrickPopup({ trick, onClose }: { trick: CompletedTrick; onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <h2>{nl.lastTrick}</h2>
      <div className="lasttrick">
        {trick.cards.map((pc) => (
          <div key={pc.seat} className="lasttrick__card">
            <CardView card={pc.card} />
            <span>{playerName(pc.seat)}</span>
          </div>
        ))}
      </div>
      <p>
        {nl.wonBy(playerName(trick.winner))} ({trick.points}
        {trick.roem > 0 && ` + ${trick.roem} ${nl.roem.toLowerCase()}`})
      </p>
      <button type="button" onClick={onClose} autoFocus>
        {nl.close}
      </button>
    </div>
  );
}
