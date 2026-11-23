import type { Card, Suit } from '../engine';
import { nl } from '../i18n/nl';

const SYMBOL: Record<Suit, string> = { klaveren: '♣', ruiten: '♦', harten: '♥', schoppen: '♠' };
const RED: Record<Suit, boolean> = { klaveren: false, ruiten: true, harten: true, schoppen: false };

interface Props {
  card?: Card;
  faceDown?: boolean;
  playable?: boolean;
  small?: boolean;
  dim?: boolean;
  onClick?: () => void;
}

/** Speelkaart als inline SVG. Geen externe afbeeldingen. */
export function CardView({ card, faceDown, playable, small, dim, onClick }: Props) {
  const cls = [
    'card',
    small && 'card--small',
    playable && 'card--playable',
    (dim || (onClick && !playable)) && 'card--dim',
  ]
    .filter(Boolean)
    .join(' ');
  const label = card && !faceDown ? nl.cardName(card) : 'dichte kaart';

  const svg = (
    <svg viewBox="0 0 70 100" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="68"
        height="98"
        rx="7"
        className={faceDown ? 'card__back' : 'card__face'}
      />
      {faceDown || !card ? (
        <rect x="7" y="7" width="56" height="86" rx="4" className="card__pattern" />
      ) : (
        <g className={RED[card.suit] ? 'card__red' : 'card__black'}>
          <text x="7" y="20" fontSize="16" fontWeight="700">
            {card.rank}
          </text>
          <text x="7" y="35" fontSize="14">
            {SYMBOL[card.suit]}
          </text>
          <text x="35" y="66" fontSize="34" textAnchor="middle">
            {SYMBOL[card.suit]}
          </text>
          <text x="63" y="92" fontSize="16" fontWeight="700" textAnchor="end">
            {card.rank}
          </text>
        </g>
      )}
    </svg>
  );

  if (!onClick)
    return (
      <div className={cls} aria-label={label}>
        {svg}
      </div>
    );
  return (
    <button type="button" className={cls} aria-label={label} disabled={!playable} onClick={onClick}>
      {svg}
    </button>
  );
}
