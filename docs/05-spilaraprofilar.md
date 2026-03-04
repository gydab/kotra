# Spilaraprófilar

> Síðast uppfært: 3. mars 2026

## Yfirlit

Hvert spilaraprófíl er miðstöð spilarans á kotra.is — safnar saman gögnum frá mörgum kerfum á einn stað.

## Prófílinnihald

### Grunnupplýsingar
- Nafn, mynd, kynning (bio)
- Aðild (frá hvaða ári)
- Félagsaðild / staða

### Tengdir reikningar
- **BG Studio Heroes** — gæluheiti, WBIF skráning (krafist af WBIF)
- **Backgammon Galaxy** — gæluheiti, rating
- **Backgammon NJ** — gæluheiti, rating

### Leikjatölfræði
- Fjöldi leikja
- Sigurhlutfall
- PR (Performance Rating)
- XG-rating
- Meðal error rate

### Mótasaga
- Listi yfir mót, staðsetning, úrslit
- Bestu úrslit

### WBIF gögn
- Titlar (BMAB)
- Röðun í WBIF Tour
- Monthly Rally staða

### Leikjaskrár (.mat)
- Hlaða upp .mat skrám
- Sjálfvirk greining ef hægt
- Sýna villutölfræði

## Gagnaflæði

```
Spilari skráir sig á kotra.is
    ↓
Slær inn gæluheiti á:
  • BG Studio Heroes (krafist fyrir WBIF)
  • BG Galaxy (valfrjálst)
  • BG NJ (valfrjálst)
    ↓
Kerfið:
  • Sækir opinber gögn af Galaxy/NJ (sjálfvirkt, scraping)
  • Sækir WBIF stigatöflu (sjálfvirkt, scraping)
  • Tekur á móti .mat skrám (handvirkt frá Heroes)
    ↓
Prófíll birtir:
  • Sameinaða tölfræði frá öllum kerfum
  • Leikjasögu og greiningar
  • XG/PR rating
  • WBIF titla og röðun
```

## Ytri þjónustur — staða

| Þjónusta | API | Scraping | Handvirkt |
|---|---|---|---|
| BG Studio Heroes | ❌ Ekkert API | ⚠️ Lokað | ✅ .mat upphlöðun |
| Backgammon Galaxy | ❌ Ekkert opinbert | ✅ Opinberir prófílar | — |
| Backgammon NJ | ❌ Ekkert opinbert | ✅ Opinberir prófílar | — |
| WBIF | ❌ Ekkert API | ✅ Opinberar stigatöflur | — |

## Aðgerðir varðandi ytri þjónustur

1. **Hafa samband við Terje Pedersen** (BG Studio) — biðja um API/export
2. **Hafa samband við WBIF nefndina** — staðfesta aðild, fá fulltrúa
3. **Byggja scraper** fyrir Galaxy/NJ opinbera prófíla
