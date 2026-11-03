# GARAŽA.gg — case opening & battles (auto tema)

Next.js 16 + Supabase. Kutije s automobilima (od Fiće do Ferrarija 250 GTO), case battles, upgrader, slide, trinity, jackpot, nagrade, gem stash i level sustav. **Svi coini su virtualni** — nema uplata ni isplata.

## Pokretanje

1. **Baza:** u Supabase dashboardu → *SQL Editor* → zalijepi i pokreni cijeli `supabase/schema.sql`
   (tablice, RLS, sve funkcije igara i seed s ~100 automobila i 22 kutije). Može se pokretati više puta.
2. **Auth:** *Authentication → Providers → Email* mora biti uključen. Za lokalni razvoj možeš isključiti
   *Confirm email* da se korisnik odmah prijavi nakon registracije.
3. **Env:** `.env.local` (lokalno) / Vercel env:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```
4. `npm install` → `npm run dev`

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
| Battles | 1v1, 1v1v1, 1v1v1v1, 6-way, 2v2, 3v3, Crazy mod (najmanje pobjeđuje), botovi, realtime lobby |
| Upgrader | više auta + coini → skuplji auto, šansa = ulog/cilj × 95%, max 80% |
| Slide | ciljani multiplikator, šansa 96%/cilj |
| Trinity | 30 polja: crvena 2×, crna 2×, zlatna 14× |
| Jackpot | pot s botovima, šansa ∝ ulog, 5% provizija |
| Nagrade | dnevna kutija sa streakom (bronca/srebro/zlato), kiša coina /30 min, tjedni i mjesečni drop, instant drop 4% |
| Gem Stash | 0,1 gem po odigranom coinu → gem kutije |
| Level | XP = odigrani coini, level L traži 25·(L−1)² XP, bonus L×10 coina, level kutije svaka 24h |
