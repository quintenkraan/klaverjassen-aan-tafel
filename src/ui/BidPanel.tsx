import { useEffect, useState } from 'react';
import { bidOptions, PIT_BID, TRUMPS, type RoundState, type Rules, type Trump } from '../engine';
import { nl } from '../i18n/nl';
import { playerName } from './names';

/**
 * Bieden (jullie variant): kies een getal (80, 90, ... tot pit) en een troef, of pas.
 * Na drie keer passen mag de hoogste bieder nog verhogen of zijn bod laten staan.
 */
export function BidPanel({
  round,
  rules,
  onBid,
  onPass,
}: {
  round: RoundState;
  rules: Rules;
  onBid: (value: number, trump: Trump) => void;
  onPass: () => void;
}) {
  const min = bidOptions(round, rules).minBid!;
  const lowest = Math.min(...TRUMPS.map((t) => min[t] ?? Infinity));
  // Begin bij het laagste kleurbod (meestal wil je op een kleur bieden).
  const start = min.harten ?? lowest;
  const [value, setValue] = useState(start);
  useEffect(() => setValue(start), [start]);
  const c = round.contract;
  const t = nl.bidding;

  return (
    <div className="bidpanel" role="group" aria-label={t.title}>
      <p className="bidpanel__state">
        {round.lastChance
          ? t.lastChance
          : c
            ? t.highest(t.value(c.value), nl.suits[c.trump], playerName(c.seat))
            : t.none}
      </p>
      <div className="bidpanel__value">
        <button
          type="button"
          aria-label={t.lower}
          disabled={value <= lowest}
          onClick={() => setValue(Math.max(lowest, value - 10))}
        >
          −
        </button>
        <strong aria-live="polite">{t.value(value)}</strong>
        <button
          type="button"
          aria-label={t.higher}
          disabled={value >= PIT_BID}
          onClick={() => setValue(Math.min(PIT_BID, value + 10))}
        >
          +
        </button>
      </div>
      <div className="bidpanel__trumps">
        {TRUMPS.map((trump, i) => {
          const m = min[trump];
          const ok = m !== null && value >= m && (trump === 'sans' || value >= 80);
          return (
            <button
              key={trump}
              type="button"
              autoFocus={i === 0}
              disabled={!ok}
              onClick={() => onBid(value, trump)}
            >
              {nl.suits[trump]}
            </button>
          );
        })}
        <button type="button" className="ghost" onClick={onPass}>
          {round.lastChance ? t.keep : nl.pass}
        </button>
      </div>
    </div>
  );
}
