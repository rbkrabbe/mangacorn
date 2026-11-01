# Mangacorn

Et browserspil om en enhjørning, der løber gennem manga-tegneseriepaneler. Man samler sølvmønter med en sky på, hopper på søde monstre (KAPOW!), samler power-ups og køber ting til enhjørningen i butikken.

Spillet er lavet med almindelig HTML, CSS og JavaScript og tegner alt på et `<canvas>`. Det kræver ingen installation og kører i alle moderne browsere, også Chrome på en Chromebook.

## Sådan spiller du

Åbn `index.html` i en browser (dobbeltklik på filen).

| Handling | Taster |
|---|---|
| Gå | ← → eller A D |
| Hop | Mellemrum, ↑ eller W |
| Pause | P eller Esc |

På en touchskærm vises knapper på skærmen. Hop på monstrene ovenfra for at besejre dem.

## Mapper og filer

```
index.html        Siden der starter spillet
src/style.css     Udseende for siden, menuerne og butikken
src/game.js       Hele spillet: baner, enhjørning, monstre, butik og lyd
assets/           Her kan egne tegninger og lyde lægges (tom indtil videre)
docs/plan.md      Plan og idéer til spillet
```

### Vigtige steder i `src/game.js`

- `ITEMS` – tingene i butikken (navn, pris, beskrivelse). `kind: 'look'` er pynt, `kind: 'boost'` er superkræfter, og ting med samme `slot` kan ikke bæres samtidig.
- `buildLevel` og `fillPanel` – hvordan kapitler og paneler bygges, og hvad der er i hvert panel.
- `CAPTIONS` – teksterne øverst i panelerne.
- `drawUnicorn`, `drawBlob`, `drawBat`, `drawCoin` – tegningen af enhjørningen, monstrene og mønterne.
- `ACC`, `MAXV`, `G`, `JV` – hvor hurtigt enhjørningen løber, og hvor højt den hopper.

## Gemte data

Mønter, købte ting og hvilket kapitel man er nået til gemmes i browserens `localStorage` under nøglen `mangacorn-v1`. Det ligger kun i den browser, man spiller i.

## Dele spillet

Fordi spillet kun består af statiske filer, kan det lægges på GitHub Pages eller en anden webhost, så andre kan spille det via et link.
