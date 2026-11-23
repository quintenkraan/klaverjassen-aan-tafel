import { nl } from '../i18n/nl';

export function RulesScreen({ onBack }: { onBack: () => void }) {
  return (
    <main className="setup rules">
      <h1>{nl.rulesTitle}</h1>
      {nl.rules.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <ul>
            {section.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
      <button type="button" onClick={onBack}>
        {nl.back}
      </button>
    </main>
  );
}
