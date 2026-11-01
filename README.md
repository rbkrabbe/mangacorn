# Mangacorn

Et browserspil om en enhjørning, der løber gennem manga-tegneseriepaneler. Man samler sølvmønter med en sky på, hopper på søde monstre (KAPOW!), hopper over Piggi, samler power-ups og køber ting til enhjørningen i butikken.

Spillet er lavet med almindelig HTML, CSS og JavaScript og tegner alt på et `<canvas>`. Det kræver ingen installation og kører i alle moderne browsere, også Chrome på en Chromebook.

## Sådan spiller du

Åbn `index.html` i en browser (dobbeltklik på filen).

| Handling | Taster |
|---|---|
| Gå | ← → eller A D |
| Hop | Mellemrum, ↑ eller W |
| Pause | P eller Esc |

På en touchskærm vises knapper på skærmen. Hop på monstrene ovenfra for at besejre dem.

### I vandet

Man synker langsomt. Tryk hop for at svømme op, og ↓ eller S for at dykke hurtigere. Find havfruehalen på havbunden ved øen, så kommer den frem, hver gang man er i vandet.

### To spillere

Vælg "2 spillere" på forsiden. Spiller 1 styrer med <kbd>A</kbd> <kbd>D</kbd> <kbd>W</kbd>, spiller 2 med <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd>. På en touchskærm har spiller 1 knapperne til venstre og spiller 2 knapperne til højre.

### iPad

Åbn spillets link i Safari. Tryk på Del-knappen og vælg "Føj til hjemmeskærm", så ligger Mangacorn som en app og åbner i fuld skærm.

## Mapper og filer

```
index.html        Siden der starter spillet
src/style.css     Udseende for siden, menuerne og butikken
src/game.js       Hele spillet: baner, enhjørning, venner, Mangaby, monstre, butik og lyd
manifest.webmanifest  Gør det muligt at lægge spillet på hjemmeskærmen
assets/           Spillets ikon. Her kan egne tegninger og lyde også lægges
docs/plan.md      Plan og idéer til spillet
```

### Vigtige steder i `src/game.js`

- `ITEMS` – tingene i butikken (navn, pris, beskrivelse). `kind: 'look'` er pynt, `kind: 'boost'` er superkræfter, og ting med samme `slot` kan ikke bæres samtidig.
- `buildLevel` og `fillPanel` – hvordan kapitler og paneler bygges, og hvad der er i hvert panel. Sværhedsgraden for hvert kapitel bestemmes også her (`pool` og `d`).
- `FRIENDS` – vennerne (navn, farver, pynt, hvad de siger). `friendFor` bestemmer, hvilken ven der er i hvert kapitel.
- `buildTown`, `drawHouse` og `drawTownDeco` – byen Mangaby, husene og skiltene.
- `hillY`, `groundAt` og `drawHill` – bjerge og bakker. Bjergets form er en liste af hjørnepunkter (`pts`) i `fillPanel`.
- `SURF`, `SEA_FLOOR`, `updateMermaid`, `drawSeaPanel`, `drawMermaid` og `drawMerTail` – havet, havfruen Marina og havfruehalen. `TAIL_COLORS` og `FIN_COLOR` er halens farver.
- `CAPTIONS` – teksterne øverst i panelerne.
- `drawUnicorn`, `drawBlob`, `drawBat`, `drawSpiky`, `drawGhost`, `drawBubbler`, `drawCoin` – tegningen af enhjørningen, monstrene og mønterne.
- `ACC`, `MAXV`, `G`, `JV` – hvor hurtigt enhjørningen løber, og hvor højt den hopper.
- `makePlayers`, `controls`, `updatePlayer` og `updateOut` – én eller to spillere, hvilke taster der styrer hvem, og redning i boblen. `P2_PAL` er farverne på spiller 2.

## Gemte data

Mønter, købte ting, venner man har mødt, om man har havfruehalen, og hvilket kapitel man er nået til gemmes i browserens `localStorage` under nøglen `mangacorn-v1`. Det ligger kun i den browser, man spiller i.

## Dele spillet

Fordi spillet kun består af statiske filer, kan det lægges på GitHub Pages eller en anden webhost, så andre kan spille det via et link.
