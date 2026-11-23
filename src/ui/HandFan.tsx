import { AnimatePresence, motion } from 'framer-motion';
import { cardId, sameCard, type Card } from '../engine';
import { CardView } from './CardView';

interface Props {
  cards: Card[];
  playable: Card[];
  active: boolean;
  onPlay: (card: Card) => void;
}

/** Je eigen hand als waaier. Klik of sleep een kaart omhoog om hem te spelen. */
export function HandFan({ cards, playable, active, onPlay }: Props) {
  const n = cards.length;
  const step = Math.min(7, 44 / Math.max(n - 1, 1));

  return (
    <div className="fan">
      <AnimatePresence initial={false}>
        {cards.map((card, i) => {
          const angle = (i - (n - 1) / 2) * step;
          const arc = Math.abs(angle) * 1.6;
          const can = playable.some((c) => sameCard(c, card));
          return (
            <motion.button
              key={cardId(card)}
              type="button"
              className={`fan__card ${can ? 'fan__card--playable' : ''}`}
              aria-label={`${card.rank} ${card.suit}`}
              disabled={!can}
              layout
              initial={{ y: 220, opacity: 0, rotate: 0 }}
              animate={{ y: arc, rotate: angle, opacity: 1 }}
              exit={{ y: -160, opacity: 0, transition: { duration: 0.25 } }}
              whileHover={can ? { y: arc - 30 } : undefined}
              drag={can}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.y < -90) onPlay(card);
              }}
              onClick={() => can && onPlay(card)}
              style={{ zIndex: i }}
            >
              <CardView card={card} dim={active && !can} />
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
