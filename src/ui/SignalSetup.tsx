import { useState } from 'react';
import {
  DEFAULT_AGREEMENT,
  DEFAULT_RULES,
  GESTURES,
  MEANINGS,
  type Agreement,
  type Meaning,
  type Rules,
  type SignalPenalty,
} from '../engine';
import { nl } from '../i18n/nl';

export interface TableConfig {
  rules: Rules;
  agreement: Agreement;
  showLog: boolean;
}

/** Seinafspraak maken met je maat, voordat je aan tafel gaat. */
export function SignalSetup({ onStart }: { onStart: (cfg: TableConfig) => void }) {
  const [agreement, setAgreement] = useState<Agreement>(DEFAULT_AGREEMENT);
  const [enabled, setEnabled] = useState(true);
  const [penalty, setPenalty] = useState<SignalPenalty>('punten');
  const [showLog, setShowLog] = useState(false);

  return (
    <main className="setup">
      <h1>{nl.setupTitle}</h1>
      <p>{nl.setupIntro}</p>

      <label className="setup__check">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {nl.signalsOn}
      </label>

      {enabled && (
        <>
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

          <label className="setup__row">
            {nl.penaltyLabel}
            <select value={penalty} onChange={(e) => setPenalty(e.target.value as SignalPenalty)}>
              <option value="punten">{nl.penaltyPoints}</option>
              <option value="spel">{nl.penaltyGame}</option>
            </select>
          </label>
          <label className="setup__check">
            <input
              type="checkbox"
              checked={showLog}
              onChange={(e) => setShowLog(e.target.checked)}
            />
            {nl.showLog}
          </label>
        </>
      )}

      <button
        type="button"
        onClick={() =>
          onStart({
            rules: { ...DEFAULT_RULES, signals: { enabled, penalty } },
            agreement,
            showLog,
          })
        }
      >
        {nl.toTable}
      </button>
    </main>
  );
}
