# Gagnagrunnshönnun

> Síðast uppfært: 3. mars 2026

## Yfirlit

PostgreSQL gagnagrunnur. Allt tvítyngt efni hefur `_is` og `_en` reiti.

## Töflur

### Players (Spilarar)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| name | VARCHAR | Fullt nafn |
| email | VARCHAR | Netfang (einka) |
| rating | INTEGER | Innlent rating |
| rank | INTEGER | Röðun |
| joined_date | DATE | Inngöngu dagsetning |
| photo_url | VARCHAR | Mynd |
| bio_is | TEXT | Kynning (íslenska) |
| bio_en | TEXT | Kynning (enska) |
| bg_heroes_nick | VARCHAR | BG Studio Heroes gæluheiti |
| bg_galaxy_nick | VARCHAR | BG Galaxy gæluheiti |
| bg_nj_nick | VARCHAR | BG NJ gæluheiti |
| wbif_id | VARCHAR | WBIF auðkenni |
| discord_id | VARCHAR | Discord notendanúmer |

### Tournaments (Mót)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| name_is | VARCHAR | Nafn (íslenska) |
| name_en | VARCHAR | Nafn (enska) |
| date | DATE | Dagsetning |
| location | VARCHAR | Staðsetning |
| type | VARCHAR | Tegund (WBIF, innlent, o.fl.) |
| description_is | TEXT | Lýsing (íslenska) |
| description_en | TEXT | Lýsing (enska) |
| status | ENUM | upcoming / active / completed |
| wbif_link | VARCHAR | Tengill á WBIF síðu |

### TournamentResults (Mótaúrslit)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| tournament_id | FK | Tengist Tournaments |
| player_id | FK | Tengist Players |
| placement | INTEGER | Staðsetning |
| points | DECIMAL | Stig |

### BoardMembers (Stjórnarmenn)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| player_id | FK (optional) | Tengist Players |
| name | VARCHAR | Nafn |
| role_is | VARCHAR | Hlutverk (íslenska) |
| role_en | VARCHAR | Hlutverk (enska) |
| photo_url | VARCHAR | Mynd |
| term_start | DATE | Upphaf kjörtímabils |
| term_end | DATE | Lok kjörtímabils |

### News (Fréttir)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| title_is | VARCHAR | Titill (íslenska) |
| title_en | VARCHAR | Titill (enska) |
| body_is | TEXT | Meginmál (íslenska) |
| body_en | TEXT | Meginmál (enska) |
| published_date | TIMESTAMP | Birtingardagur |
| author | VARCHAR | Höfundur |

### Resources (Námsefni og tenglar)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| title_is | VARCHAR | Titill (íslenska) |
| title_en | VARCHAR | Titill (enska) |
| url | VARCHAR | Tengill |
| type | ENUM | book / website / app / course / video |
| description_is | TEXT | Lýsing (íslenska) |
| description_en | TEXT | Lýsing (enska) |

### Registrations (Skráningar)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| player_id | FK | Tengist Players |
| tournament_id | FK | Tengist Tournaments |
| registration_date | TIMESTAMP | Skráningardagur |
| status | ENUM | pending / confirmed / cancelled |

### MediaCoverage (Fjölmiðlaumfjöllun)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| title | VARCHAR | Titill greinar |
| outlet | VARCHAR | Fjölmiðill |
| url | VARCHAR | Tengill |
| published_date | DATE | Dagsetning birtingar |
| type | ENUM | tv / radio / print / web |
| description_is | TEXT | Stutt lýsing |

### MatchFiles (Leikjaskrár)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| player_id | FK | Tengist Players |
| tournament_id | FK (optional) | Tengist Tournaments |
| file_url | VARCHAR | Slóð á .mat skrá |
| uploaded_date | TIMESTAMP | Hlaðið upp |
| opponent_name | VARCHAR | Andstæðingur |
| result | VARCHAR | Úrslit |
| pr_rating | DECIMAL | Performance Rating |
| analysis_data | JSONB | Greiningargögn |

### Pages (Síður — static efni)

| Reitur | Tegund | Lýsing |
|---|---|---|
| id | UUID / SERIAL | Aðallykill |
| slug | VARCHAR | URL slug |
| title_is | VARCHAR | Titill (íslenska) |
| title_en | VARCHAR | Titill (enska) |
| content_is | TEXT | Efni (íslenska) |
| content_en | TEXT | Efni (enska) |
