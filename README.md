# GARAŽA.gg — case opening & battles (auto tema)

Next.js 16 + Supabase. Kutije s automobilima (od Fiće do Ferrarija 250 GTO), case battles, upgrader, slide, trinity, jackpot, nagrade, gem stash i level sustav. **Svi coini su virtualni** — nema uplata ni isplata.

## Pokretanje

1. **Baza:** u Supabase dashboardu → *SQL Editor* → zalijepi i pokreni cijeli `supabase/schema.sql`
   (tablice, RLS, sve funkcije igara i seed s ~100 automobila i 22 kutije). Može se pokretati više puta.
2. **Auth:** *Authentication → Providers → Email* uključen.
   - *Authentication → URL Configuration*: Site URL = tvoja Vercel domena, a u *Redirect URLs* dodaj
     `https://<domena>/auth/confirm` i `http://localhost:3000/auth/confirm`.
   - *Authentication → Email Templates → Confirm signup*: link zamijeni s
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
     — klik na link potvrđuje račun i odmah prijavljuje korisnika (radi i na drugom uređaju).
3. **Env:** `.env.local` (lokalno) / Vercel env:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   NEXT_PUBLIC_CARIMAGES_KEY=ci_...   # opcionalno: prave fotografije auta (carimagesapi.com)
   ```
   Bez `NEXT_PUBLIC_CARIMAGES_KEY` prikazuju se crteži. Ključ je javan (tako ga API predviđa) pa ga u
   CarImages dashboardu zaključaj na svoju domenu. Pogrešne fotografije isključi u `/admin` → Slike.
4. **Prvi admin** — nakon registracije pokreni u SQL Editoru:
   ```sql
   update public.user_controls set role = 'admin'
   where user_id = (select id from public.profiles where username = 'TvojeIme');
   ```
   Admin panel je na `/admin` (pregled, korisnici, admin log).
5. `npm install` → `npm run dev`

## Arhitektura

- `supabase/schema.sql` — sva logika igara je u Postgres `SECURITY DEFINER` funkcijama
  (`open_case`, `create_battle`, `join_battle`, `fill_battle_bots`, `upgrade_items`, `play_slide`,
  `play_trinity`, `play_jackpot`, `claim_daily`, `claim_reward`, `sell_items`). Klijent ne može
  mijenjati balans/inventar — RLS dopušta samo čitanje.
- `supabase/generate_seed.py` — katalog automobila i kutija; težine se računaju tako da je EV kutije ~92% cijene.
- `utils/supabase/*` + `proxy.ts` — `@supabase/ssr` klijenti; proxy (Next 16 "middleware") osvježava sesiju.
- `app/*` — stranice; animacije (reel, kotač, upgrader) samo prikazuju ishod koji je već izračunao server.

## Mehanike

| Značajka | Kako radi |
|---|---|
| Kutije | 1–5 odjednom, brzo otvaranje, demo vrtnja, prodaja dobitaka |
| Battles | 1v1, 1v1v1, 1v1v1v1, 6-way, 2v2, 3v3; prekidači Crazy (manje pobjeđuje) i Jackpot (vrijednost = šansa, rulet na kraju) koji se mogu kombinirati; botovi, realtime lobby |
| Upgrader | više auta + coini → skuplji auto, šansa = ulog/cilj × 95%, max 80% |
| Slide | ciljani multiplikator, šansa 96%/cilj |
| Trinity | 30 polja: crvena 2×, crna 2×, zlatna 14× |
| Jackpot | pot s botovima, šansa ∝ ulog, 5% provizija |
| Nagrade | dnevna kutija sa streakom (bronca/srebro/zlato), kiša coina /30 min, tjedni i mjesečni drop, instant drop 4% |
| Gem Stash | 0,1 gem po odigranom coinu → gem kutije |
| Admin | stanje i gemovi (+/−), sreća 0,25–5× (skrivena od korisnika), blokiranje, uloge, level, affiliate kod i provizija, poklanjanje auta, reset nagrada, statistika i RTP po igri, log svih promjena |
| Affiliate | `/register?ref=kod` → novi igrač +50 coina, pozivatelj dobiva proviziju (default 5%) od svega što pozvani odigra |
| Chat | poruke se čuvaju 6 sati, level + ime uz poruku, dijeljenje battlea u chat |
| Zvuk | sintetizirani efekti (Web Audio), gumb za isključivanje u navigaciji |
| Level | XP = odigrani coini, level L traži 25·(L−1)² XP, bonus L×10 coina, level kutije svaka 24h |
