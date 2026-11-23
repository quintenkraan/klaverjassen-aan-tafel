# SPEC: Klaverjassen aan tafel

## Status
- [x] F1 Opzet  - [x] F2 Engine  - [x] F3 2D-tafel  - [ ] F4 POV
- [ ] F5 Bot-AI  - [ ] F6 Seinen  - [ ] F7 Score/opslaan  - [ ] F8 Afwerking

## S1 Doel
First-person klaverjasgame in de browser. POV van één speler, maat tegenover, tegenstanders
links/rechts. Seinen met je maat met kans op succes en kans op betrapt worden.
Statisch te hosten via GitHub Pages.

## S2 Techniek
Vite, React, TS strict, Framer Motion, Web Audio (mute-knop), Vitest, ESLint, Prettier.
2.5D met CSS 3D transforms; renderlaag later vervangbaar door react-three-fiber.
GitHub Actions: test, build, deploy naar Pages bij push op main (base via VITE_BASE).
Seedable RNG voor alle toeval (src/engine/rng.ts).

## S3 Regels
32 kaarten, 4 spelers, 2 teams, delen 3-2-3, deler schuift door.
Troef: B20 9:14 A11 10:10 H4 V3 8:0 7:0. Niet-troef: A11 10:10 H4 V3 B2 rest 0.
Laatste slag +10 (totaal 162). Roem per slag: 3 op rij 20, 4 op rij 50, stuk 20,
4 gelijk 100, 4 boeren 200. Pit +100. Nat: spelend team niet meer dan de helft
(punten + roem) dan alles naar tegenpartij. Bekennen, troefplicht, overtroefplicht.
Varianten: Amsterdams / Rotterdams; troef verplicht rondgaand / Utrechts / vrij;
16 spellen of tot puntenlimiet. Elke regel en randgeval getest (ondertroeven,
roem in laatste slag, nat met roem, pit met roem).
Gekozen in F2: niet kunnen overtroeven = niet ondertroeven (tenzij alleen troef);
gelijk spel (81/81) is nat; vier gelijke telt voor elke rang; roem wordt automatisch
geteld; speler na de deler komt altijd uit. API: src/engine/index.ts (startRound,
bidOptions, passBid, chooseTrump, playableCards, playCard, finishRound, totals).

F3 (klaar): src/ui/useGame.ts (state + bot-timing + pauze na slag), src/ui/Table2D.tsx,
src/ui/CardView.tsx (SVG-kaart), bot in src/engine/ai/simple.ts. F4 vervangt Table2D
door de POV-tafel en hergebruikt useGame en CardView.

## S4 POV en sfeer
Schuine camera over tafel, eigen kaarten in waaier (hover tilt, klik/sleep speelt).
Avatars met naam en karakter (Ome Henk, Tante Ria, Sjaak), kleine animaties,
variabele bedenktijd, tekstballonnen met tafelpraat. Scoreblok als papiertje
(wij/zij, roem, rondeoverzicht). Laatste slag terugkijken.

## S5 Seinen
Seinen: knipogen, wenkbrauw, tikken op tafel, kaart met rug van de hand, keelschrapen,
oor krabben. Bij start een seinafspraak met je maat (instelbare tabel:
"troefboer", "speel harten", "ik heb roem", "niet troeven").
Per sein drie kansen: maat ziet het / maat begrijpt het / tegenstander betrapt het.
Gevolgen: maat speelt op juiste of foute info; betrapt = waarschuwing, daarna straf
(instelbaar), en tegenstanders leren het sein. Maat seint ook naar jou (subtiele
animatie, optioneel seinlog). Tegenstanders seinen onderling; "Ik zag dat!" roepen,
terecht = straf voor hen, onterecht = kost jou iets. Vaker seinen maakt de tafel
achterdochtiger. Alles in de engine, testbaar met seed.

## S6 Bot-AI
Altijd legaal. Heuristieken: troeven tellen, gevallen kaarten onthouden, roem en punten
bijgooien bij maat, laag spelen als tegenstander hoog ligt. Troefkeuze via handwaardering.
Persoonlijkheid: agressief/voorzichtig, geheugen, oplettendheid, seinneiging, eerlijkheid.
Moeilijkheid: makkelijk/gemiddeld/sterk.

## S7 Schermen en opslag
Start (nieuw spel, instellingen, regels), seinafspraak, speltafel, ronde- en eindstand.
localStorage om te hervatten. Desktop, tablet, mobiel landschap. Toetsenbordbediening.

## S8 Later (niet bouwen, wel ruimte voor houden)
Online multiplayer, volledige 3D, statistieken.
