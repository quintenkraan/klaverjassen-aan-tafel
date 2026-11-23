# Klaverjassen aan tafel

Vite + React + TypeScript (strict). Spec: SPEC.md (lees alleen de sectie van je huidige fase).
Engine in src/engine/ is pure TS, geen React. Publieke types in src/engine/types.ts.
UI-teksten in src/i18n/nl.ts. Kaarten als SVG in code, geen externe assets.
Toeval altijd via src/engine/rng.ts (seedable).

Werkwijze:
- Lees alleen bestanden die je nodig hebt; begin bij types.ts in plaats van de hele engine.
- Gerichte edits, geen hele bestanden herschrijven of in de chat tonen.
- Check met `npm test` en `npm run build`. Geen screenshots.
- Geen subagents of extra plannen tenzij gevraagd. Antwoord kort.
- Fase klaar: commit, werk de status in SPEC.md bij, en geef max. 5 regels samenvatting.
