import { AnimatePresence, motion } from 'framer-motion';
import { cardId, type Card, type Seat, type Trick } from '../engine';
import { nl } from '../i18n/nl';
import { CardView } from './CardView';

/** Waar een kaart vandaan komt (en naartoe gaat als die speler de slag pakt). */
const EDGE: Record<Seat, { x: number; y: number }> = {
  0: { x: 0, y: 300 },
  1: { x: -380, y: 0 },
  2: { x: 0, y: -300 },
  3: { x: 380, y: 0 },
};
const SPOT: Record<Seat, { x: number; y: number }> = {
  0: { x: 0, y: 60 },
  1: { x: -90, y: 0 },
  2: { x: 0, y: -60 },
  3: { x: 90, y: 0 },
};

/** Vaste, licht scheve hoek per kaart, zodat het eruitziet als neergegooid. */
function tilt(card: Card): number {
  let h = 0;
  for (const ch of cardId(card)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(h) % 25) - 12;
}

export function TrickArea({ trick, winner }: { trick: Trick | undefined; winner: Seat | null }) {
  return (
    <div
      className="tablewrap"
      role="region"
      aria-label={
        trick?.cards.length
          ? `${nl.onTable}: ${trick.cards.map((pc) => `${nl.players[pc.seat]} ${nl.cardName(pc.card)}`).join(', ')}`
          : nl.emptyTable
      }
    >
      <div className="felt">
        <div className="felt__center">
          <AnimatePresence custom={winner}>
            {trick?.cards.map((pc) => (
              <motion.div
                key={cardId(pc.card)}
                className="felt__card"
                custom={winner}
                variants={{
                  enter: { ...EDGE[pc.seat], opacity: 0, rotate: 0 },
                  rest: { ...SPOT[pc.seat], opacity: 1, rotate: tilt(pc.card) },
                  leave: (w: Seat | null) => ({
                    ...(w === null ? {} : EDGE[w]),
                    opacity: 0,
                    scale: 0.7,
                    transition: { duration: 0.45 },
                  }),
                }}
                initial="enter"
                animate="rest"
                exit="leave"
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              >
                <CardView card={pc.card} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
