import { useState } from 'react';
import { GESTURES, MEANINGS, type Agreement, type Meaning } from '../engine';
import { nl } from '../i18n/nl';

/** Seinafspraak maken met je maat, voordat je aan tafel gaat. */
export function SignalSetup({
  initial,
  onStart,
  onBack,
}: {
  initial: Agreement;
  onStart: (agreement: Agreement) => void;
  onBack: () => void;
}) {
  const [agreement, setAgreement] = useState<Agreement>(initial);

  return (
    <main className="setup">
      <h1>{nl.setupTitle}</h1>
      <p>{nl.setupIntro}</p>
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
      <div className="setup__buttons">
        <button type="button" onClick={() => onStart(agreement)}>
          {nl.toTable}
        </button>
        <button type="button" className="ghost" onClick={onBack}>
          {nl.back}
        </button>
      </div>
    </main>
  );
}
