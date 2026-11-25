import { useState } from 'react';
import { GESTURES, MEANINGS, type Agreement, type Meaning } from '../engine';
import { nl } from '../i18n/nl';

/** Seinafspraak maken met je maat, voordat je aan tafel gaat. */
export function SignalSetup({
  initial,
  initialOn,
  onStart,
  onBack,
}: {
  initial: Agreement;
  /** Seinen in dit potje aan of uit (onthouden voor de volgende keer). */
  initialOn: boolean;
  onStart: (agreement: Agreement, signalsOn: boolean) => void;
  onBack: () => void;
}) {
  const [agreement, setAgreement] = useState<Agreement>(initial);
  const [on, setOn] = useState(initialOn);

  return (
    <main className="setup">
      <h1>{nl.setupTitle}</h1>
      <label className="setup__toggle">
        <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} />
        {nl.signalsThisGame}
      </label>
      {!on && <p>{nl.signalsOffNote}</p>}
      {on && <p>{nl.setupIntro}</p>}
      {on && (
        <table className="setup__table">
          <thead>
            <tr>
              <th>{nl.setupGesture}</th>
              <th>{nl.setupMeaning}</th>
            </tr>
          </thead>
          <tbody>
            {GESTURES.map((g) => (
              <tr key={g}>
                <td>{nl.gestures[g]}</td>
                <td>
                  <select
                    value={agreement[g] ?? ''}
                    aria-label={nl.gestures[g]}
                    onChange={(e) =>
                      setAgreement({
                        ...agreement,
                        [g]: (e.target.value || null) as Meaning | null,
                      })
                    }
                  >
                    <option value="">{nl.noMeaning}</option>
                    {MEANINGS.map((m) => (
                      <option key={m} value={m}>
                        {nl.meaning(m)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="setup__buttons">
        <button type="button" onClick={() => onStart(agreement, on)}>
          {nl.toTable}
        </button>
        <button type="button" className="ghost" onClick={onBack}>
          {nl.back}
        </button>
      </div>
    </main>
  );
}
