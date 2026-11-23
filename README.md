# Klaverjassen aan tafel

Een first-person klaverjasgame in de browser. Je speelt vanuit de ogen van één speler,
met je maat tegenover je, en je kunt (met wat risico) seinen.

Status en volledige specificatie: zie [SPEC.md](SPEC.md).

## Lokaal starten

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

## Spelregels

- 4 spelers in 2 teams, 32 kaarten (7 t/m aas), 8 slagen per spel.
- Troef: boer 20, negen 14, aas 11, tien 10, heer 4, vrouw 3. Overige kleuren: aas 11,
  tien 10, heer 4, vrouw 3, boer 2. Laatste slag +10, samen 162.
- Roem per slag: drie op een rij 20, vier op een rij 50, stuk (heer + vrouw troef) 20,
  vier gelijke 100, vier boeren 200. Alle slagen (pit) +100.
- Haalt het spelende team niet meer dan de helft, dan is het nat en krijgt de tegenpartij alles.
- Bekennen verplicht, anders troeven en overtroeven. Ondertroeven alleen als je niets anders hebt.
  Amsterdams: heeft je maat de slag, dan hoef je niet te troeven.
