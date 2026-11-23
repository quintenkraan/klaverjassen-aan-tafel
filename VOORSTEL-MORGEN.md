# Voorstel voor morgen

Stand van zaken (23 november 2026, avond):

- Het **3D-café** staat lokaal: echte mensen (Mixamo), jij op de bank bij het raam met Sjaak
  naast je en de spiegel in je rug, de bar met achterbar, de ingang met het houten schot.
  Je ziet je eigen armen en kaarten en kijkt rond door te slepen.
- **Online spelen v1** werkt: tafel maken, code of link delen, meedoen, samen spelen. Getest met
  twee tabbladen (gastheer + gast).
- Alles is **lokaal gecommit, maar nog niet gepusht**. De live site is dus nog de oude versie.

## Stap 1: online zetten (2 minuten, jij)

Typ in de chat: **"push maar naar GitHub"**. Of zelf in PowerShell:

```powershell
cd $HOME\Documents\klaverjassen-aan-tafel; git push
```

Na een paar minuten staat de nieuwe versie op https://quintenkraan.github.io/klaverjassen-aan-tafel/

## Stap 2: testen met echte mensen (15 minuten, jij)

1. Open de site, kies **Online spelen**, maak een tafel en stuur de link naar 1 tot 3 vrienden.
2. Let op: werkt het verbinden (ook via 4G of een bedrijfsnetwerk)? Hoe voelt seinen tussen
   echte mensen? Is de 3D-tafel soepel op jullie laptops en telefoons?
3. Noteer wat opvalt en geef het in één bericht door.

## Stap 3: kies wat je daarna wilt (ik doe het werk)

Elke optie is een losse opdracht. Plak de startprompt in een **nieuwe sessie** in deze map:
dat is het zuinigst met tokens. Model-advies staat erbij.

| #   | Wat                             | Waarom                                                                         | Startprompt                                                                                                                                | Model  |
| --- | ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| A   | **Online robuuster**            | Nu: ververst iemand de pagina, dan is hij weg; strenge netwerken kunnen falen. | "Maak online spelen robuust: opnieuw verbinden na verversen, stoel terugkrijgen, en een TURN-server als fallback. Zie src/net en SPEC S8." | Opus   |
| B   | **Eigen seinafspraak per team** | Online krijgt het team zonder gastheer nu een willekeurige afspraak.           | "Laat beide teams in de online lobby hun eigen seinafspraak maken."                                                                        | Sonnet |
| C   | **Meer leven in het café**      | Andere gasten aan de bar en tafeltjes, achtergrondgeroezemoes, glazen bier.    | "Voeg cafégasten toe in src/ui/three/Cafe.tsx met de bestaande Mixamo-modellen en animaties, plus zacht geroezemoes."                      | Sonnet |
| D   | **Gebaren in 3D verfijnen**     | Knipoog en wenkbrauw zijn nu kleine overlays; nog niet visueel getest.         | "Controleer en verbeter de seingebaren van de 3D-mensen (src/ui/three/Person.tsx) met screenshots."                                        | Opus   |
| E   | **Rondlopen**                   | Nu kijk je rond vanaf je plek; lopen door het café (WASD/tik) kan ook.         | "Voeg vrij rondlopen toe in het 3D-café met botsing tegen bar, tafels en het houten schot bij de deur."                                    | Opus   |
| F   | **Statistieken**                | Gewonnen potjes, hoe vaak nat, hoe vaak betrapt bij seinen.                    | "Voeg statistieken per speler toe (localStorage), zichtbaar op het startscherm."                                                           | Sonnet |

Mijn advies: **A**, omdat online spelen anders snel stukloopt bij echte mensen. Daarna **B**,
en **C** voor de sfeer.

## Wat je nergens voor nodig hebt

- Geen account of server voor online spelen (PeerJS is gratis en openbaar).
- Alleen voor optie A (de TURN-fallback) is misschien een gratis account bij een
  TURN-dienst nodig. Dat hoor je dan van mij voordat ik het nodig heb.
