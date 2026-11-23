import { nl } from './i18n/nl';

export function App() {
  return (
    <main className="start">
      <h1>{nl.title}</h1>
      <p>{nl.subtitle}</p>
      <button type="button" disabled>
        {nl.newGame}
      </button>
    </main>
  );
}
