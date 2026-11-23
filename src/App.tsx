import { useState } from 'react';
import { nl } from './i18n/nl';
import { SignalSetup, type TableConfig } from './ui/SignalSetup';
import { TablePOV } from './ui/TablePOV';

type Stage =
  { kind: 'start' } | { kind: 'setup' } | { kind: 'play'; seed: number; cfg: TableConfig };

export function App() {
  const [stage, setStage] = useState<Stage>({ kind: 'start' });

  if (stage.kind === 'play') return <TablePOV seed={stage.seed} {...stage.cfg} />;
  if (stage.kind === 'setup') {
    return (
      <SignalSetup onStart={(cfg) => setStage({ kind: 'play', seed: Date.now() >>> 0, cfg })} />
    );
  }
  return (
    <main className="start">
      <h1>{nl.title}</h1>
      <p>{nl.subtitle}</p>
      <button type="button" onClick={() => setStage({ kind: 'setup' })}>
        {nl.newGame}
      </button>
    </main>
  );
}
