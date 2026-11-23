import { useState } from 'react';
import { nl } from './i18n/nl';
import { TablePOV } from './ui/TablePOV';

export function App() {
  const [seed, setSeed] = useState<number | null>(null);

  if (seed !== null) return <TablePOV seed={seed} />;

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
