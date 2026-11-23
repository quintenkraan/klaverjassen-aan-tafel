import { useEffect, useState } from 'react';
import { bidOptions, playableCards, sortHand } from '../engine';
import { nl } from '../i18n/nl';
import { Avatar } from './Avatar';
import { HandFan } from './HandFan';
import { GameOverOverlay, LastTrickPopup, RoundOverlay, ScoreSheet } from './Panels';
import { sound } from './sound';
import { TrickArea } from './TrickArea';
import { useGame } from './useGame';
import { useTalk } from './useTalk';

/** First-person tafel: jij onderin, maat tegenover, tegenstanders links en rechts. */
export function TablePOV({ seed }: { seed: number }) {
  const { game, pause, over, play, pass, choose, nextRound, newGame } = useGame(seed);
  const speech = useTalk(game, seed);
  const [muted, setMuted] = useState(sound.isMuted());
  const [showLast, setShowLast] = useState(false);
  const { round, rules } = game;

  const myTurn = round.turn === 0 && !pause && round.phase !== 'klaar';
  const lastTrick = round.tricks.at(-1);
  const shownTrick = pause ? lastTrick : round.currentTrick;
  const playable = myTurn && round.phase === 'spelen' ? playableCards(round, rules) : [];
  const bid = myTurn && round.phase === 'bieden' ? bidOptions(round, rules) : null;

  // Geluid: kaart op tafel, slag binnenhalen, delen.
  const played = round.tricks.length * 4 + round.currentTrick.cards.length;
  useEffect(() => {
    if (played > 0) sound.card();
  }, [played]);
  useEffect(() => {
    if (!pause && round.tricks.length > 0) sound.collect();
  }, [pause, round.tricks.length]);
  useEffect(() => {
    sound.deal();
  }, [game.roundIndex]);

  let status: string = nl.waitingFor(nl.players[round.turn]);
  if (myTurn) status = bid ? nl.chooseTrump : nl.dragHint;
  if (pause && lastTrick) status = nl.wonBy(nl.players[lastTrick.winner]);
  else if (round.phase === 'klaar') status = nl.roundOver;

  return (
    <div className="layout">
      <div className="room">
        <div className="info">
          <span>
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
          </span>
          <span className="info__status">{status}</span>
          <span className="info__buttons">
            <button type="button" disabled={!lastTrick} onClick={() => setShowLast(true)}>
              {nl.lastTrick}
            </button>
            <button
              type="button"
              aria-label={muted ? nl.soundOn : nl.soundOff}
              onClick={() => {
                sound.setMuted(!muted);
                setMuted(!muted);
              }}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </span>
        </div>

        {([1, 2, 3] as const).map((seat) => (
          <Avatar
            key={seat}
            seat={seat}
            cards={round.hands[seat]!.length}
            thinking={round.turn === seat && !pause && round.phase !== 'klaar'}
            dealer={round.dealer === seat}
            speech={speech?.seat === seat ? speech : null}
          />
        ))}

        <TrickArea trick={shownTrick} winner={lastTrick?.winner ?? null} />

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

        <div className={`me ${myTurn ? 'me--turn' : ''}`}>
          {nl.players[0]}
          {round.dealer === 0 && ` (${nl.dealer})`}
        </div>
        <HandFan
          cards={sortHand(round.hands[0]!, round.trump)}
          playable={playable}
          active={myTurn && round.phase === 'spelen'}
          onPlay={play}
        />

        {showLast && lastTrick && (
          <LastTrickPopup trick={lastTrick} onClose={() => setShowLast(false)} />
        )}
        {over ? (
          <GameOverOverlay game={game} onAgain={newGame} />
        ) : (
          round.phase === 'klaar' && !pause && <RoundOverlay game={game} onNext={nextRound} />
        )}
      </div>
      <ScoreSheet game={game} />
    </div>
  );
}
