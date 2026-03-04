# Arkitektúr & kerfi

> Síðast uppfært: 3. mars 2026

## Yfirlitsmynd

```
┌─────────────────────────────────────────────────────┐
│                    kotra.is                          │
│   Innlent miðstöð — prófílar, fréttir, fræðsla     │
│   póstlisti, fjölmiðlar, Discord, skráning          │
├─────────────────────────────────────────────────────┤
│          ↕ tengist / les frá                         │
├──────────────────┬──────────────────────────────────┤
│    wbif.net      │   heroes.backgammonstudio.com     │
│  Mótastjórnun    │   Leikjaþjónn                    │
│  Stigatöflur     │   .mat skrár                      │
│  Röðun/ranking   │   Spilun í rauntíma               │
│  Skráning í mót  │                                   │
└──────────────────┴──────────────────────────────────┘
         ↕                        ↕
┌──────────────────┐  ┌──────────────────────────┐
│  BG Galaxy       │  │  Backgammon NJ           │
│  (valfrjálst)    │  │  (valfrjálst)            │
└──────────────────┘  └──────────────────────────┘
```

## Hlutverk hvers kerfis

| Kerfi | Hlutverk | Samband við kotra.is |
|---|---|---|
| **kotra.is** | Innlend kotrugátt, prófílar, fréttir, fræðsla | Miðstöðin |
| **wbif.net** | Alþjóðleg online mótastjórnun | Kotra.is les/tengir |
| **heroes.backgammonstudio.com** | Leikjaþjónn — öll mót spiluð hér | .mat skrár fara þaðan |
| **BG Galaxy** | Annar leikjaþjónn, ótengt WBIF | Scraping af prófílum |
| **BG NJ** | Annar leikjaþjónn | Scraping af prófílum |
| **Google Workspace** | @kotra.is póstur, Drive, Calendar | Innri stjórnunartól |
| **Discord** | Samfélag og umræðuvettvangur | Widget á kotra.is |
| **Listmonk** | Póstlisti / fréttabréf | Innfellt á kotra.is |

## Google Workspace uppsetning

- **Áætlun**: Business Starter (~$7/notanda/mán)
- **Notendur**: formadur@, ritari@, gjaldkeri@, info@kotra.is
- **DNS**: MX → Google, TXT (SPF), CNAME (DKIM), DMARC
- **Sameiginlegt**: Google Drive möppa fyrir stjórnargögn

## Discord skipulag

| Rás | Tilgangur |
|---|---|
| #tilkynningar | Fréttir og mótaauglýsingar |
| #almenn-spjall | Frjálst spjall |
| #mót | Mótaumræður, skráning |
| #hjálp-og-ráðleggingar | Nýliðar og kennsla |
| #fjölmiðlar | Tenglar á íslenska umfjöllun |
| #wbif | WBIF mót og upplýsingar |

## Listmonk (póstlisti)

- Docker container
- PostgreSQL gagnagrunnur
- SMTP: Google Workspace eða AWS SES / Mailgun
- Listar: Almennur fréttabréfslisti, WBIF mót, mótaauglýsingar
- Widget innfellt á kotra.is

## Tæknival ✅ Ákveðið

> Ákveðið 3. mars 2026: **Astro + Supabase**

### Valinn stack

```
┌─────────────────────────────────────────────────┐
│                 FRONTEND                         │
│  Astro 5.x — Static-first, Island Architecture  │
│  Tailwind CSS 4.x — Utility-first CSS           │
│  TypeScript — Tegundaröryggi                     │
│  astro-i18n — Tvítyngd (IS/EN)                   │
├─────────────────────────────────────────────────┤
│              INTERACTIVE ISLANDS                  │
│  Svelte 5 / React — Aðeins þar sem þarf         │
│  (leitar, form, real-time components)            │
├─────────────────────────────────────────────────┤
│                 BACKEND (BaaS)                    │
│  Supabase                                        │
│  ├── PostgreSQL — Gagnagrunnur                   │
│  ├── Auth — Notendastjórnun                      │
│  ├── Storage — Myndir, .mat skrár                │
│  ├── Edge Functions — Server-side virkni         │
│  └── Realtime — Live updates (mót, stigatöflur)  │
├─────────────────────────────────────────────────┤
│                 HOSTING                           │
│  Cloudflare Pages — Ókeypis, ótakmarkað bandwidth│
│  (eða Vercel / Netlify)                          │
└─────────────────────────────────────────────────┘
```

### Af hverju Astro + Supabase?

| Þáttur | Lýsing |
|---|---|
| **Lágt viðhald** | Supabase sér um DB, auth, storage, backups — við skrifum bara frontend |
| **Hraði** | Astro skilar static HTML — síðan er bliðhröð |
| **Kostnaður** | $0/mán á free tier (nóg fyrir kotra.is í mörg ár) |
| **Öryggi** | Lítil árásarflötur — enginn Node.js runtime, minna JS |
| **i18n** | Innbyggður stuðningur í Astro |
| **TypeScript** | Full type-safety án Prisma/ORM — Supabase auto-generates types frá DB |
| **Sveigjanleiki** | Island architecture — bæta við React/Svelte þar sem þarf |

### Supabase uppsetning

| Þjónusta | Free Tier | Notkun |
|---|---|---|
| **PostgreSQL** | 500 MB | Spilarar, mót, fréttir, allt |
| **Auth** | 50.000 MAU | Innskráning (email, social) |
| **Storage** | 1 GB | Myndir, .mat skrár, skjöl |
| **Edge Functions** | 500K invocations/mán | API endpoints, cron jobs |
| **Realtime** | 200 concurrent | Live stigatöflur |

### Kostnaðaryfirlit

| Þjónusta | Kostnaður |
|---|---|
| Cloudflare Pages | $0 |
| Supabase (free) | $0 |
| kotra.is lén | ~$50/ár |
| Google Workspace | $7/notanda/mán |
| Listmonk (sjálfshýst) | $5–10/mán VPS |
| **Samtals (start)** | **~$12–22/mán + lén** |

### Möppustrúktúr (fyrirhuguð)

```
kotra/
├── src/
│   ├── pages/
│   │   ├── is/              # Íslenskar síður
│   │   │   ├── index.astro
│   │   │   ├── um-kotru.astro
│   │   │   ├── mot/
│   │   │   └── spilarar/
│   │   ├── en/              # Enskar síður
│   │   │   ├── index.astro
│   │   │   ├── about.astro
│   │   │   ├── tournaments/
│   │   │   └── players/
│   │   └── api/             # API routes (Supabase Edge)
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── PlayerCard.astro
│   │   ├── TournamentCard.astro
│   │   └── islands/         # Interactive (Svelte/React)
│   │       ├── SearchBar.svelte
│   │       └── NewsletterForm.svelte
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── AdminLayout.astro
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   ├── i18n.ts          # Þýðingar
│   │   └── types.ts         # Auto-generated frá Supabase
│   ├── i18n/
│   │   ├── is.json          # Íslenskar þýðingar
│   │   └── en.json          # Enskar þýðingar
│   └── styles/
│       └── global.css       # Tailwind + custom styles
├── public/
│   ├── fonts/
│   └── images/
├── supabase/
│   ├── migrations/          # SQL migrations
│   ├── functions/           # Edge Functions
│   └── seed.sql             # Test data
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
└── .env                     # SUPABASE_URL, SUPABASE_ANON_KEY
```

### Supabase Database Types (auto-generated)

```typescript
// src/lib/types.ts — sjálfvirkt búið til með `supabase gen types`
export type Database = {
  public: {
    Tables: {
      players: { Row: Player; Insert: PlayerInsert; Update: PlayerUpdate }
      tournaments: { Row: Tournament; Insert: ...; Update: ... }
      news: { Row: News; Insert: ...; Update: ... }
      // ...
    }
  }
}
```

### Lykilskipanir

```bash
# Búa til verkefni
npm create astro@latest kotra

# Bæta við integrations
npx astro add tailwind
npx astro add svelte        # Fyrir interactive islands

# Supabase CLI
npx supabase init
npx supabase start           # Local dev
npx supabase gen types typescript --local > src/lib/types.ts

# Deploy
npx wrangler pages deploy dist/   # Cloudflare Pages
```
