import { scoreRound, teamOf, totals, type CompletedTrick, type GameState } from '../engine';
import { nl } from '../i18n/nl';
import { CardView } from './CardView';

export function ScoreSheet({ game }: { game: GameState }) {
  const sum = totals(game);
  return (
    <aside className="sheet">
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
    </aside>
  );
}

export function RoundOverlay({ game, onNext }: { game: GameState; onNext: () => void }) {
  const r = game.round;
  const s = scoreRound(r.tricks, r.playingTeam!);
  return (
    <div className="overlay">
      <h2>
        {nl.roundOver}
        {s.nat && ` ${nl.nat}`}
        {s.pit !== null && ` ${nl.pit}`}
      </h2>
      <p>
        {nl.trump} {nl.suits[r.trump!]}, {nl.plays}: {nl.teams[teamOf(r.trumpChooser!)]}
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
        </tbody>
      </table>
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

export function LastTrickPopup({ trick, onClose }: { trick: CompletedTrick; onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <h2>{nl.lastTrick}</h2>
      <div className="lasttrick">
        {trick.cards.map((pc) => (
          <div key={pc.seat} className="lasttrick__card">
            <CardView card={pc.card} />
            <span>{nl.players[pc.seat]}</span>
          </div>
        ))}
      </div>
      <p>
        {nl.wonBy(nl.players[trick.winner])} ({trick.points}
        {trick.roem > 0 && ` + ${trick.roem} ${nl.roem.toLowerCase()}`})
      </p>
      <button type="button" onClick={onClose} autoFocus>
        {nl.close}
      </button>
    </div>
  );
}
