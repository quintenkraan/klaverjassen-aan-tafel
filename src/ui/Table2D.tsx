import {
  bidOptions,
  playableCards,
  sameCard,
  scoreRound,
  sortHand,
  teamOf,
  totals,
  type Seat,
} from '../engine';
import { nl } from '../i18n/nl';
import { CardView } from './CardView';
import { useGame } from './useGame';

const SIDE: Record<Exclude<Seat, 0>, string> = { 1: 'left', 2: 'top', 3: 'right' };

/** Eenvoudige 2D-tafel (F3) om de engine speelbaar te maken. In F4 komt de POV-tafel. */
export function Table2D({ seed }: { seed: number }) {
  const { game, pause, over, play, pass, choose, nextRound, newGame } = useGame(seed);
  const { round, rules } = game;
  const myTurn = round.turn === 0 && !pause && round.phase !== 'klaar';

  const shownTrick = pause ? round.tricks.at(-1) : round.currentTrick;
  const playable = myTurn && round.phase === 'spelen' ? playableCards(round, rules) : [];
  const bid = myTurn && round.phase === 'bieden' ? bidOptions(round, rules) : null;
  const sum = totals(game);

  let status: string = nl.waitingFor(nl.players[round.turn]);
  if (myTurn) status = bid ? nl.chooseTrump : nl.yourTurn;
  const lastTrick = round.tricks.at(-1);
  if (pause && lastTrick) status = `${nl.players[lastTrick.winner]} ✓`;
  else if (round.phase === 'klaar') status = nl.roundOver;

  return (
    <div className="layout">
      <div className="table">
        <div className="info">
          {round.trump ? (
            <>
              {nl.trump}: <strong>{nl.suits[round.trump]}</strong> ({nl.plays}:{' '}
              {nl.players[round.trumpChooser!]})
            </>
          ) : round.proposedSuit ? (
            nl.proposed(nl.suits[round.proposedSuit])
          ) : (
            nl.chooseTrump
          )}
          <span className="info__status">{status}</span>
        </div>

        {([1, 2, 3] as const).map((seat) => (
          <div key={seat} className={`seat seat--${SIDE[seat]}`}>
            <div
              className={`seat__name ${round.turn === seat && !pause ? 'seat__name--turn' : ''}`}
            >
              {nl.players[seat]}
              {round.dealer === seat && ` (${nl.dealer})`}
            </div>
            <div className="seat__cards">
              {round.hands[seat]!.map((_, i) => (
                <CardView key={i} faceDown small />
              ))}
            </div>
          </div>
        ))}

        <div className="trick">
          {shownTrick?.cards.map((pc) => (
            <div key={pc.seat} className={`trick__card trick__card--${pc.seat}`}>
              <CardView card={pc.card} />
            </div>
          ))}
        </div>

        <div className="hand">
          <div className={`seat__name ${myTurn ? 'seat__name--turn' : ''}`}>
            {nl.players[0]}
            {round.dealer === 0 && ` (${nl.dealer})`}
          </div>
          {bid && (
            <div className="bid">
              {bid.suits.map((s) => (
                <button key={s} type="button" onClick={() => choose(s)}>
                  {nl.suits[s]}
                </button>
              ))}
              {bid.canPass && (
                <button type="button" onClick={pass}>
                  {nl.pass}
                </button>
              )}
            </div>
          )}
          <div className="hand__cards">
            {sortHand(round.hands[0]!, round.trump).map((card) => (
              <CardView
                key={`${card.suit}${card.rank}`}
                card={card}
                playable={playable.some((c) => sameCard(c, card))}
                onClick={() => play(card)}
              />
            ))}
          </div>
        </div>

        {over ? (
          <div className="overlay">
            <h2>{nl.gameOver}</h2>
            <p>
              {nl.teams[0]} {sum[0]} - {sum[1]} {nl.teams[1]}
            </p>
            <p>{sum[0] === sum[1] ? nl.draw : nl.winner(nl.teams[sum[0] > sum[1] ? 0 : 1])}</p>
            <button type="button" onClick={newGame}>
              {nl.playAgain}
            </button>
          </div>
        ) : (
          round.phase === 'klaar' && !pause && <RoundOverlay game={game} onNext={nextRound} />
        )}
      </div>

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
    </div>
  );
}

function RoundOverlay({
  game,
  onNext,
}: {
  game: ReturnType<typeof useGame>['game'];
  onNext: () => void;
}) {
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
