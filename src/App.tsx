import { useState } from 'react';
import { nl } from './i18n/nl';
import { Table2D } from './ui/Table2D';

export function App() {
  const [seed, setSeed] = useState<number | null>(null);

  if (seed !== null) return <Table2D seed={seed} />;

  return (
    <main className="start">
      <h1>{nl.title}</h1>
      <p>{nl.subtitle}</p>
      <button type="button" onClick={() => setSeed(Date.now() >>> 0)}>
        {nl.newGame}
      </button>
    </main>
  );
}
