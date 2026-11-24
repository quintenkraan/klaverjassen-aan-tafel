import { useState } from 'react';
import type { Difficulty, GameLength, SignalPenalty, TrumpMode, Variant } from '../engine';
import { nl } from '../i18n/nl';
import type { Settings, View } from './storage';

const LENGTHS: Record<string, GameLength> = {
  p150: { kind: 'punten', target: 150 },
  s16: { kind: 'spellen', count: 16 },
  s8: { kind: 'spellen', count: 8 },
  p1000: { kind: 'punten', target: 1000 },
  p1500: { kind: 'punten', target: 1500 },
};

function lengthKey(l: GameLength): string {
  return l.kind === 'spellen' ? `s${l.count}` : `p${l.target}`;
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="choice">
      <legend>{label}</legend>
      {options.map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            name={label}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export function SettingsScreen({
  settings,
  onSave,
  onBack,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onBack: () => void;
}) {
  const [s, setS] = useState(settings);
  const set = nl.set;

  return (
    <main className="setup">
      <h1>{nl.settings}</h1>

      <Choice<View>
        label={set.view}
        value={s.view}
        options={[
          { value: '3d', label: set.view3d },
          { value: '2d', label: set.view2d },
        ]}
        onChange={(view) => setS({ ...s, view })}
      />
      <Choice<Variant>
        label={set.variant}
        value={s.variant}
        options={[
          { value: 'rotterdams', label: set.rotterdams },
          { value: 'amsterdams', label: set.amsterdams },
        ]}
        onChange={(variant) => setS({ ...s, variant })}
      />
      <Choice<TrumpMode>
        label={set.trumpMode}
        value={s.trumpMode}
        options={[
          { value: 'bieden', label: set.bieden },
          { value: 'verplicht', label: set.verplicht },
          { value: 'vrij', label: set.vrij },
          { value: 'utrechts', label: set.utrechts },
        ]}
        onChange={(trumpMode) =>
          setS(
            trumpMode === 'bieden'
              ? { ...s, trumpMode, variant: 'amsterdams', length: LENGTHS.p150! }
              : { ...s, trumpMode },
          )
        }
      />
      <Choice
        label={set.length}
        value={lengthKey(s.length)}
        options={Object.keys(LENGTHS).map((k) => ({ value: k, label: set.lengths[k]! }))}
        onChange={(k) => setS({ ...s, length: LENGTHS[k]! })}
      />
      <Choice<Difficulty>
        label={set.difficulty}
        value={s.difficulty}
        options={[
          { value: 'makkelijk', label: set.makkelijk },
          { value: 'gemiddeld', label: set.gemiddeld },
          { value: 'sterk', label: set.sterk },
        ]}
        onChange={(difficulty) => setS({ ...s, difficulty })}
      />

      <fieldset className="choice">
        <legend>{set.signals}</legend>
        <label>
          <input
            type="checkbox"
            checked={s.signals.enabled}
            onChange={(e) => setS({ ...s, signals: { ...s.signals, enabled: e.target.checked } })}
          />
          {nl.signalsOn}
        </label>
        {s.signals.enabled && (
          <>
            <label className="setup__row">
              {nl.penaltyLabel}
              <select
                value={s.signals.penalty}
                onChange={(e) =>
                  setS({
                    ...s,
                    signals: { ...s.signals, penalty: e.target.value as SignalPenalty },
                  })
                }
              >
                <option value="punten">{nl.penaltyPoints}</option>
                <option value="spel">{nl.penaltyGame}</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={s.showLog}
                onChange={(e) => setS({ ...s, showLog: e.target.checked })}
              />
              {nl.showLog}
            </label>
          </>
        )}
      </fieldset>

      <div className="setup__buttons">
        <button type="button" onClick={() => onSave(s)}>
          {nl.save}
        </button>
        <button type="button" className="ghost" onClick={onBack}>
          {nl.back}
        </button>
      </div>
    </main>
  );
}
