import { AnimatePresence, motion } from 'framer-motion';
import type { Gesture, Seat } from '../engine';
import { nl } from '../i18n/nl';
import { CardView } from './CardView';
import { playerName } from './names';

export interface Speech {
  seat: Seat;
  text: string;
  id: number;
}

type Look = { skin: string; hair: string; shirt: string; style: 'curls' | 'bald' | 'cap' };

const LOOKS: Record<Exclude<Seat, 0>, Look> = {
  1: { skin: '#f1c7a5', hair: '#8a4f2a', shirt: '#7b3fa0', style: 'curls' },
  2: { skin: '#e8b996', hair: '#a8a8a8', shirt: '#2f6db3', style: 'bald' },
  3: { skin: '#d39b74', hair: '#262626', shirt: '#b8392b', style: 'cap' },
};

interface Props {
  seat: Exclude<Seat, 0>;
  cards: number;
  thinking: boolean;
  dealer: boolean;
  speech: Speech | null;
  /** Gebaar dat deze speler nu maakt (kort en subtiel, makkelijk te missen). */
  gesture: Gesture | null;
  /** Knikt (Henk, als hij jouw sein zag). */
  nod: boolean;
}

/** Gestileerde tafelgenoot met knipperende ogen, gebaren, denk-animatie en tekstballon. */
export function Avatar({ seat, cards, thinking, dealer, speech, gesture, nod }: Props) {
  const look = LOOKS[seat];
  const cls = [
    'avatar',
    `avatar--${seat}`,
    thinking && 'avatar--thinking',
    gesture && `avatar--g-${gesture}`,
    nod && 'avatar--nod',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls}>
      <AnimatePresence>
        {speech && (
          <motion.div
            key={speech.id}
            className="bubble"
            role="status"
            aria-label={`${playerName(seat)}: ${speech.text}`}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            {speech.text}
          </motion.div>
        )}
      </AnimatePresence>
      <svg viewBox="0 0 120 110" className="avatar__fig" aria-hidden="true">
        <path d="M14 110 Q20 74 60 72 Q100 74 106 110Z" fill={look.shirt} />
        <g className="avatar__head">
          <circle cx="60" cy="44" r="25" fill={look.skin} />
          {look.style === 'curls' &&
            [38, 48, 60, 72, 82].map((x, i) => (
              <circle key={x} cx={x} cy={i % 2 ? 22 : 27} r="10" fill={look.hair} />
            ))}
          {look.style === 'bald' && (
            <>
              <ellipse cx="36" cy="44" rx="5" ry="9" fill={look.hair} />
              <ellipse cx="84" cy="44" rx="5" ry="9" fill={look.hair} />
              <path d="M48 56 Q60 50 72 56 Q60 60 48 56Z" fill={look.hair} />
            </>
          )}
          {look.style === 'cap' && (
            <>
              <path d="M34 36 Q60 8 86 36Z" fill={look.hair} />
              <rect x="60" y="32" width="34" height="5" rx="2" fill={look.hair} />
            </>
          )}
          <g className="avatar__brows" stroke="#4a3020" strokeWidth="2" fill="none">
            <path d="M46 37 Q51 34 56 37" />
            <path d="M64 37 Q69 34 74 37" />
          </g>
          <circle className="avatar__eye" cx="51" cy="43" r="2.6" fill="#222" />
          <circle className="avatar__eye avatar__eye--r" cx="69" cy="43" r="2.6" fill="#222" />
          <path d="M52 60 Q60 64 68 60" stroke="#6b3b2a" strokeWidth="2" fill="none" />
        </g>
        <circle className="avatar__hand" cx="88" cy="50" r="7" fill={look.skin} />
        <rect
          className="avatar__flip"
          x="84"
          y="80"
          width="16"
          height="22"
          rx="2"
          fill="#8c1c13"
          stroke="#fff"
        />
        <text className="avatar__ahum" x="84" y="72" fontSize="10" fill="#fff">
          ahum
        </text>
      </svg>
      <div className="avatar__name">
        {playerName(seat)}
        {dealer && ` (${nl.dealer})`}
      </div>
      <div className="avatar__cards">
        {Array.from({ length: cards }, (_, i) => (
          <CardView key={i} faceDown small />
        ))}
      </div>
    </div>
  );
}
