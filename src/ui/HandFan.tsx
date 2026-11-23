import { AnimatePresence, motion } from 'framer-motion';
import type { KeyboardEvent } from 'react';
import { cardId, sameCard, type Card } from '../engine';
import { nl } from '../i18n/nl';
import { CardView } from './CardView';
import { playerName } from './names';

interface Props {
  cards: Card[];
  playable: Card[];
  active: boolean;
  onPlay: (card: Card) => void;
}

/** Pijltjestoetsen springen tussen speelbare kaarten. */
function moveFocus(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  if (buttons.length === 0) return;
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next = e.key === 'ArrowRight' ? i + 1 : i - 1;
  buttons[(next + buttons.length) % buttons.length]!.focus();
  e.preventDefault();
}

/** Je eigen hand als waaier. Klik, sleep omhoog, of gebruik 1-8 / pijltjes + Enter. */
export function HandFan({ cards, playable, active, onPlay }: Props) {
  const n = cards.length;
  const step = Math.min(7, 44 / Math.max(n - 1, 1));

  return (
    <div className="fan" role="group" aria-label={playerName(0)} onKeyDown={moveFocus}>
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
              aria-label={`${i + 1}: ${nl.cardName(card)}`}
              disabled={!can}
              layout
              initial={{ y: 220, opacity: 0, rotate: 0 }}
              animate={{ y: arc, rotate: angle, opacity: 1 }}
              exit={{ y: -160, opacity: 0, transition: { duration: 0.25 } }}
              whileHover={can ? { y: arc - 30 } : undefined}
              whileFocus={can ? { y: arc - 30 } : undefined}
              drag={can}
              dragSnapToOrigin
              onDragEnd={(_, info) => {
                if (info.offset.y < -90) onPlay(card);
              }}
              onClick={() => can && onPlay(card)}
              style={{ zIndex: i }}
            >
              <CardView card={card} dim={active && !can} />
              {active && can && <span className="fan__key">{i + 1}</span>}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
