# Klaverjassen aan tafel

Een first-person klaverjasgame in de browser. Je zit aan een keukentafel met Ome Henk
(je maat) tegenover je en Tante Ria en Sjaak links en rechts. Je kunt met Henk seinen,
maar pas op: hij snapt het niet altijd, en de tegenstanders kijken mee.

## Wat zit erin

- Volledige klaverjasregels: bekennen, troeven, overtroeven, roem, stuk, pit en nat.
- Varianten: Rotterdams of Amsterdams; troef verplicht, vrij of Utrechts; 8 of 16 spellen,
  of tot 1000/1500 punten.
- Bots met karakter en geheugen, in drie sterktes (makkelijk, gemiddeld, sterk).
- Seinen met kansen: je maat ziet het wel of niet, begrijpt het goed of fout, en de
  tegenstanders kunnen je betrappen. Zelf "Ik zag dat!" roepen kan ook.
- Tafelpraat, animaties en geluid (zonder geluidsbestanden, via Web Audio).
- Potje wordt automatisch bewaard; je kunt later verder spelen.
- Te bedienen met muis, aanraken of toetsenbord. Liggend te spelen op telefoon en tablet.

## Spelen

| Actie                   | Muis / touch             | Toetsenbord                    |
| ----------------------- | ------------------------ | ------------------------------ |
| Kaart spelen            | Klik, of sleep omhoog    | `1`-`8`, of pijltjes + `Enter` |
| Seinen                  | Knop "Seinen" linksonder | `S`, daarna `1`-`6`            |
| Tegenstanders betrappen | Knop "Ik zag dat!"       | `Z`                            |
| Laatste slag bekijken   | Knop "Laatste slag"      | `L`                            |
| Geluid aan/uit          | 🔊                       | `M`                            |
| Sluiten                 |                          | `Esc`                          |

De volledige spelregels staan in de game onder **Spelregels**, en technisch in [SPEC.md](SPEC.md).

## Lokaal starten

Nodig: Node.js 20 of nieuwer.

```bash
npm install
npm run dev
```

Overige commando's: `npm test`, `npm run lint`, `npm run build`, `npm run preview`.

## Online zetten via GitHub Pages

1. Maak een repository op GitHub en push deze code naar de branch `main`.
2. Ga in de repository naar **Settings > Pages** en kies bij **Source** voor **GitHub Actions**.
3. Bij elke push naar `main` wordt de game getest, gebouwd en gepubliceerd op
   `https://<gebruikersnaam>.github.io/<repo-naam>/`.

Andere hosting (Netlify, Vercel) kan ook: build-commando `npm run build`, map `dist`.

## Online spelen

Op het startscherm: **Online spelen**. Eén persoon maakt een tafel en krijgt een code
(bijvoorbeeld `XRNKB`) en een link (`...?tafel=XRNKB`). Anderen openen de link of typen de
code. De eerste die meedoet wordt je maat; lege plekken spelen bots.

Hoe het werkt: peer-to-peer via WebRTC ([PeerJS](https://peerjs.com)). De openbare
PeerJS-server wordt alleen gebruikt om elkaar te vinden; daarna gaan zetten rechtstreeks
tussen de browsers. De browser van de gastheer rekent het spel uit en stuurt iedere speler
alleen wat die mag zien (`viewFor` in `src/engine/view.ts`). Geen eigen server of account nodig.
Beperking: de gastheer moet zijn venster open houden.

## 3D: het café en de mensen

- De 3D-tafel staat in een bruin café (bar, achterbar, spiegelwand, ramen, ingang met
  houten schot), nagebouwd in code in `src/ui/three/Cafe.tsx`. Plattegrond: `src/ui/three/layout.ts`.
- Jij zit op de bank met Sjaak naast je; Ria tegenover, Henk (je maat) schuin tegenover.
- Slepen = rondkijken. "Kijk naar tafel" zet je blik terug. Kaarten klik je in je eigen handen.
- In Instellingen kun je terug naar de eenvoudige tafel (voor oudere apparaten).

De mensen en animaties komen van [Mixamo](https://www.mixamo.com) (Adobe), gratis te
gebruiken in games. De ruwe FBX-bestanden staan niet in de repo (`assets-src/` is genegeerd);
de omgezette, gecomprimeerde GLB's staan in `public/models/`. Omzetten deed ik zo:

```bash
FBX2glTF --binary --input persoon.fbx --output persoon      # npm-pakket fbx2gltf
npx gltf-transform optimize persoon.glb public/models/persoon.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 --simplify false
```

## Opbouw

```
src/
  engine/        Spelregels, bots en seinen. Pure TypeScript, geen React, volledig getest.
    types.ts     Alle publieke types.
    rules.ts     Legale zetten en wie de slag wint.
    roem.ts      Roem per slag.
    round.ts     Delen, troef bepalen, spelen, telling.
    game.ts      Een heel potje.
    signals.ts   Seinen: kansen, betrappen, straffen.
    ai/          Bots: geheugen, persoonlijkheid, kaartkeuze.
  ui/            React: tafel, avatars, waaier, schermen, opslag, geluid.
  i18n/nl.ts     Alle teksten.
```

Alle toeval loopt via een seedable generator (`src/engine/rng.ts`), zodat potjes en tests
reproduceerbaar zijn.
