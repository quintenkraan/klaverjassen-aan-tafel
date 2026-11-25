import { lazy, Suspense, useEffect, useState } from 'react';
import { webglAvailable } from './three/support';

/** three.js is groot: pas laden als de 3D-tafel echt nodig is. */
const Scene3D = lazy(() => import('./three/Scene3D'));
import { bidOptions, GESTURES, playableCards, sameCard, sortHand, totals } from '../engine';
import { nl } from '../i18n/nl';
import { BidPanel } from './BidPanel';
import { Avatar } from './Avatar';
import { HandFan } from './HandFan';
import { GameOverOverlay, LastTrickPopup, RoundOverlay, ScoreSheet, SignalLog } from './Panels';
import { sound } from './sound';
import type { TableConfig } from './storage';
import { TrickArea } from './TrickArea';
import { useGame, type GameController } from './useGame';
import { useTalk } from './useTalk';
import type { GameState } from '../engine';
import { playerName } from './names';

interface Props {
  seed: number;
  config: TableConfig;
  /** Opgeslagen potje om te hervatten. */
  initial?: GameState;
  onExit: () => void;
}

/** Alleen spelen tegen bots. */
export function TablePOV({ seed, config, initial, onExit }: Props) {
  const g = useGame(seed, config, initial);
  return <TableView g={g} seed={seed} config={config} onExit={onExit} />;
}

/**
 * First-person tafel: jij onderin, maat tegenover, tegenstanders links en rechts.
 * Werkt op elke GameController: alleen spelen, online host of online gast.
 */
export function TableView({
  g,
  seed,
  config,
  onExit,
}: {
  g: GameController;
  seed: number;
  config: TableConfig;
  onExit: () => void;
}) {
  const { agreement, showLog } = config;
  const { game, pause, over, play, pass, choose, nextRound, newGame, gesture, nod, line } = g;
  const talk = useTalk(game, seed);
  const speech = line && (!talk || line.id > talk.id) ? line : talk;
  const [muted, setMuted] = useState(sound.isMuted());
  const [showLast, setShowLast] = useState(false);
  const [menu, setMenu] = useState(false);
  const nodding = nod;
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

  const hand = sortHand(round.hands[0]!, round.trump);
  const use3d = (config.view ?? '3d') === '3d' && webglAvailable();
  const tableLabel = shownTrick?.cards.length
    ? `${nl.onTable}: ${shownTrick.cards.map((pc) => `${playerName(pc.seat)} ${nl.cardName(pc.card)}`).join(', ')}`
    : nl.emptyTable;
  const signalsOn = rules.signals.enabled && round.phase === 'spelen';
  const toggleMute = () => {
    sound.setMuted(!muted);
    setMuted(!muted);
  };

  // Toetsenbord: 1-8 kaart spelen (of gebaar kiezen als het seinmenu open is),
  // S seinen, Z "Ik zag dat!", L laatste slag, M geluid, Esc sluiten.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const typing = t instanceof Element && t.closest('input, select, textarea');
      if (e.ctrlKey || e.metaKey || e.altKey || typing) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        setMenu(false);
        setShowLast(false);
      } else if (/^[1-8]$/.test(k)) {
        const n = Number(k) - 1;
        if (menu && GESTURES[n]) {
          g.signal(GESTURES[n]);
          setMenu(false);
        } else {
          const card = hand[n];
          if (card && playable.some((c) => sameCard(c, card))) play(card);
        }
      } else if (k === 's' && signalsOn) setMenu((m) => !m);
      else if (k === 'z' && signalsOn) g.accuse();
      else if (k === 'l' && lastTrick) setShowLast((v) => !v);
      else if (k === 'm') toggleMute();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let status: string = nl.waitingFor(playerName(round.turn));
  const auction = rules.trumpMode === 'bieden';
  if (myTurn) status = bid ? (auction ? nl.bidding.title : nl.chooseTrump) : nl.dragHint;
  if (pause && lastTrick) status = nl.wonBy(playerName(lastTrick.winner));
  else if (round.phase === 'klaar')
    status = round.playingTeam === null ? nl.bidding.passedOut : nl.roundOver;

  return (
    <div className="layout">
      <div className="rotate-hint" role="alert">
        {nl.rotateHint}
      </div>
      <div className="room">
        <div className="info">
          <span>
            {round.trump ? (
              <>
                {nl.trump}: <strong>{nl.suits[round.trump]}</strong> ({nl.plays}:{' '}
                {playerName(round.trumpChooser!)}
                {round.contract && `, ${nl.bidding.value(round.contract.value)}`})
              </>
            ) : round.proposedSuit ? (
              nl.proposed(nl.suits[round.proposedSuit])
            ) : auction ? (
              round.contract ? (
                nl.bidding.highest(
                  nl.bidding.value(round.contract.value),
                  nl.suits[round.contract.trump],
                  playerName(round.contract.seat),
                )
              ) : (
                nl.bidding.title
              )
            ) : (
              nl.chooseTrump
            )}
          </span>
          <span className="info__status" role="status" aria-live="polite">
            {status}
          </span>
          <span className="info__buttons">
            <button type="button" onClick={onExit}>
              {nl.menu}
            </button>
            <button type="button" disabled={!lastTrick} onClick={() => setShowLast(true)}>
              {nl.lastTrick}
            </button>
            <button
              type="button"
              aria-label={muted ? nl.soundOn : nl.soundOff}
              onClick={toggleMute}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </span>
        </div>

        {use3d && (
          <Suspense fallback={<div className="loading3d">{nl.loading3d}</div>}>
            <Scene3D
              trick={shownTrick}
              winner={lastTrick?.winner ?? null}
              handCounts={[round.hands[1]!.length, round.hands[2]!.length, round.hands[3]!.length]}
              thinking={!pause && round.phase !== 'klaar' ? round.turn : null}
              dealer={round.dealer}
              speech={speech}
              gesture={gesture}
              nodSeat={nodding ? 2 : null}
              label={tableLabel}
              myCards={hand}
              playable={playable}
              onPlay={play}
              score={{
                rows: game.scores.map((s) => ({
                  total: s.total,
                  nat: s.nat ? s.playingTeam : null,
                })),
                sum: totals(game),
              }}
            />
          </Suspense>
        )}

        {!use3d &&
          ([1, 2, 3] as const).map((seat) => (
            <Avatar
              key={seat}
              seat={seat}
              cards={round.hands[seat]!.length}
              thinking={round.turn === seat && !pause && round.phase !== 'klaar'}
              dealer={round.dealer === seat}
              speech={speech?.seat === seat ? speech : null}
              gesture={gesture?.seat === seat ? gesture.gesture : null}
              nod={seat === 2 && nodding}
            />
          ))}

        {!use3d && <TrickArea trick={shownTrick} winner={lastTrick?.winner ?? null} />}

        {bid && auction && <BidPanel round={round} rules={rules} onBid={g.bid} onPass={pass} />}
        {bid && !auction && (
          <div className="bid">
            {bid.suits.map((s, i) => (
              <button key={s} type="button" autoFocus={i === 0} onClick={() => choose(s)}>
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

        <div
          className={`me ${myTurn ? 'me--turn' : ''} ${use3d && gesture?.seat !== 0 ? 'sr-only' : ''}`}
        >
          {gesture?.seat === 0 ? (
            nl.youDid(nl.gestures[gesture.gesture])
          ) : (
            <>
              {playerName(0)}
              {round.dealer === 0 && ` (${nl.dealer})`}
            </>
          )}
        </div>

        {signalsOn && (
          <>
            <div className="signals">
              {menu && (
                <div className="signals__menu">
                  {GESTURES.map((gs) => (
                    <button
                      key={gs}
                      type="button"
                      onClick={() => {
                        g.signal(gs);
                        setMenu(false);
                      }}
                    >
                      {nl.gestures[gs]}
                      <small>{agreement[gs] ? nl.meaning(agreement[gs]) : nl.noMeaning}</small>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" aria-expanded={menu} onClick={() => setMenu(!menu)}>
                {nl.signal}
              </button>
            </div>
            <button type="button" className="accuse" onClick={g.accuse}>
              {nl.accuse}
            </button>
          </>
        )}
        {/* In 3D zitten je kaarten in je handen; de HTML-waaier blijft voor schermlezers en Tab. */}
        <div className={use3d ? 'sr-only' : undefined}>
          <HandFan
            cards={hand}
            playable={playable}
            active={myTurn && round.phase === 'spelen'}
            onPlay={play}
          />
        </div>

        {showLast && lastTrick && (
          <LastTrickPopup trick={lastTrick} onClose={() => setShowLast(false)} />
        )}
        {over ? (
          <GameOverOverlay game={game} onAgain={newGame} />
        ) : (
          round.phase === 'klaar' &&
          round.playingTeam !== null &&
          !pause && <RoundOverlay game={game} onNext={nextRound} />
        )}
      </div>
      {/* In 3D staat de stand op het briefje op tafel; deze blijft voor schermlezers. */}
      <ScoreSheet game={game} hidden={use3d}>
        {showLog && rules.signals.enabled && <SignalLog game={game} />}
      </ScoreSheet>
    </div>
  );
}
