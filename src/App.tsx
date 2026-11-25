import { useState } from 'react';
import { isGameOver, totals, type GameState } from './engine';
import { nl } from './i18n/nl';
import { RulesScreen } from './ui/RulesScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { SignalSetup } from './ui/SignalSetup';
import {
  clearGame,
  configFrom,
  loadGame,
  loadSettings,
  saveSettings,
  type TableConfig,
} from './ui/storage';
import { TablePOV } from './ui/TablePOV';
import { Online } from './ui/online/Online';

/** Code uit een uitnodigingslink (?tafel=CODE). */
function codeFromUrl(): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get('tafel') ?? undefined;
  } catch {
    return undefined;
  }
}

type Stage =
  | { kind: 'start' }
  | { kind: 'settings' }
  | { kind: 'rules' }
  | { kind: 'setup' }
  | { kind: 'online'; code?: string }
  | { kind: 'play'; seed: number; config: TableConfig; initial?: GameState };

export function App() {
  const [stage, setStage] = useState<Stage>(() => {
    const code = codeFromUrl();
    return code ? { kind: 'online', code } : { kind: 'start' };
  });
  const [settings, setSettings] = useState(loadSettings);
  const [saved, setSaved] = useState(loadGame);
  const toStart = () => {
    setSaved(loadGame());
    setStage({ kind: 'start' });
  };

  const startNew = (agreement = settings.agreement, signalsOn = settings.signals.enabled) => {
    const next = { ...settings, agreement, signals: { ...settings.signals, enabled: signalsOn } };
    setSettings(next);
    saveSettings(next);
    clearGame();
    setStage({ kind: 'play', seed: Date.now() >>> 0, config: configFrom(next) });
  };

  switch (stage.kind) {
    case 'play':
      return (
        <TablePOV
          key={stage.seed}
          seed={stage.seed}
          config={stage.config}
          initial={stage.initial}
          onExit={toStart}
        />
      );
    case 'settings':
      return (
        <SettingsScreen
          settings={settings}
          onBack={toStart}
          onSave={(s) => {
            setSettings(s);
            saveSettings(s);
            toStart();
          }}
        />
      );
    case 'rules':
      return <RulesScreen onBack={toStart} />;
    case 'online':
      return (
        <Online
          config={configFrom(settings)}
          initialCode={stage.code}
          onExit={() => {
            window.history.replaceState(null, '', window.location.pathname);
            toStart();
          }}
        />
      );
    case 'setup':
      return (
        <SignalSetup
          initial={settings.agreement}
          initialOn={settings.signals.enabled}
          onStart={startNew}
          onBack={toStart}
        />
      );
  }

  const canResume = saved && !isGameOver(saved.game);
  const [us, them] = canResume ? totals(saved.game) : [0, 0];
  return (
    <main className="start">
      <h1>{nl.title}</h1>
      <p>{nl.subtitle}</p>
      <div className="start__buttons">
        {canResume && (
          <button
            type="button"
            onClick={() =>
              setStage({
                kind: 'play',
                seed: saved.game.seed,
                config: saved.config,
                initial: saved.game,
              })
            }
          >
            {nl.resume}
            <small>{nl.resumeInfo(saved.game.scores.length, us, them)}</small>
          </button>
        )}
        <button
          type="button"
          onClick={() => (settings.signals.enabled ? setStage({ kind: 'setup' }) : startNew())}
        >
          {nl.newGame}
          {canResume && <small>{nl.newGameWarning}</small>}
        </button>
        <button type="button" onClick={() => setStage({ kind: 'online' })}>
          {nl.playOnline}
        </button>
        <button type="button" className="ghost" onClick={() => setStage({ kind: 'settings' })}>
          {nl.settings}
        </button>
        <button type="button" className="ghost" onClick={() => setStage({ kind: 'rules' })}>
          {nl.rulesTitle}
        </button>
      </div>
    </main>
  );
}
