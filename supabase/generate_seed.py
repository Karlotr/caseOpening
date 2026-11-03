# Pokreni: python generate_seed.py  -> seed.sql (već uključen na kraju schema.sql)
# Generator za supabase/seed dio: automobili + kutije s težinama izračunatim tako da
# očekivana vrijednost (EV) kutije bude ~ zadani postotak cijene.
import json, math

# (brand, model, year, category, body, value)
CARS = [
    # Istočni blok / Yu nostalgija
    ("Zastava", "750 \"Fićo\"", 1965, "Yu klasik", "classic", 0.60),
    ("Yugo", "45", 1985, "Yu klasik", "hatch", 0.90),
    ("Zastava", "101 \"Stojadin\"", 1978, "Yu klasik", "hatch", 1.20),
    ("Zastava", "Koral In", 1991, "Yu klasik", "hatch", 1.30),
    ("Trabant", "601", 1964, "Istočni blok", "classic", 0.80),
    ("Fiat", "126p \"Peglica\"", 1980, "Istočni blok", "classic", 0.70),
    ("Wartburg", "353", 1975, "Istočni blok", "sedan", 1.10),
    ("Dacia", "1300", 1979, "Istočni blok", "sedan", 1.00),
    ("Moskvič", "412", 1972, "Istočni blok", "sedan", 1.40),
    ("Lada", "2107", 1988, "Istočni blok", "sedan", 1.80),
    ("Lada", "Niva 4x4", 1977, "Istočni blok", "suv", 2.50),
    ("Renault", "4 \"Katrca\"", 1970, "Europski klasik", "hatch", 1.60),
    ("Citroën", "2CV", 1968, "Europski klasik", "classic", 3.50),
    ("Volkswagen", "Golf II", 1987, "Europski klasik", "hatch", 4.00),
    ("Mercedes-Benz", "W123 240D", 1982, "Europski klasik", "sedan", 8.00),
    # Gradski
    ("Fiat", "Panda", 2005, "Gradski", "hatch", 0.50),
    ("Volkswagen", "Polo", 2010, "Gradski", "hatch", 0.90),
    ("Opel", "Corsa C", 2003, "Gradski", "hatch", 0.80),
    ("Renault", "Clio II", 2002, "Gradski", "hatch", 1.00),
    ("Peugeot", "206", 2001, "Gradski", "hatch", 0.70),
    ("Škoda", "Octavia RS", 2008, "Gradski", "sedan", 2.20),
    ("Toyota", "Corolla", 2004, "Gradski", "sedan", 2.00),
    ("Fiat", "500", 1957, "Europski klasik", "classic", 3.00),
    ("Volkswagen", "Buba 1200", 1963, "Europski klasik", "classic", 4.20),
    # JDM
    ("Honda", "Civic Type R EK9", 1997, "JDM", "hatch", 6.00),
    ("Mazda", "MX-5 NA", 1990, "JDM", "coupe", 8.00),
    ("Nissan", "Silvia S15", 1999, "JDM", "coupe", 30.0),
    ("Toyota", "AE86 Sprinter Trueno", 1985, "JDM", "coupe", 35.0),
    ("Mitsubishi", "Lancer Evo VI TME", 2000, "JDM", "sedan", 45.0),
    ("Datsun", "240Z", 1970, "JDM", "coupe", 55.0),
    ("Mazda", "RX-7 FD", 1993, "JDM", "coupe", 70.0),
    ("Toyota", "Supra MK4", 1998, "JDM", "coupe", 120.0),
    ("Honda", "NSX NA1", 1991, "JDM", "super", 160.0),
    ("Nissan", "Skyline GT-R R34", 1999, "JDM", "coupe", 180.0),
    ("Nissan", "GT-R R35 Nismo", 2022, "JDM", "coupe", 220.0),
    ("Subaru", "Impreza 22B STi", 1998, "JDM", "sedan", 260.0),
    ("Lexus", "LFA", 2011, "JDM", "super", 900.0),
    # Muscle
    ("Chevrolet", "Chevelle SS 454", 1970, "Muscle", "muscle", 70.0),
    ("Chevrolet", "Camaro Z/28", 1969, "Muscle", "muscle", 90.0),
    ("Dodge", "Challenger SRT Demon 170", 2023, "Muscle", "muscle", 110.0),
    ("Pontiac", "GTO \"The Judge\"", 1969, "Muscle", "muscle", 120.0),
    ("Dodge", "Charger R/T", 1970, "Muscle", "muscle", 150.0),
    ("Chevrolet", "Corvette C2 Sting Ray", 1963, "Muscle", "coupe", 200.0),
    ("Ford", "Mustang Boss 429", 1969, "Muscle", "muscle", 300.0),
    ("Plymouth", "Hemi 'Cuda", 1971, "Muscle", "muscle", 1500.0),
    ("Shelby", "Cobra 427", 1965, "Muscle", "classic", 3000.0),
    ("Ford", "GT40 MkII", 1966, "Muscle", "super", 8000.0),
    ("Ford", "Model T", 1915, "Američki", "classic", 3.0),
    ("Ford", "Crown Victoria", 2005, "Američki", "sedan", 2.5),
    ("Jeep", "Wrangler YJ", 1990, "Američki", "suv", 12.0),
    ("Ford", "F-150 Raptor", 2017, "Američki", "suv", 40.0),
    ("Chevrolet", "Bel Air", 1957, "Američki", "classic", 45.0),
    ("Chevrolet", "Impala SS", 1964, "Američki", "classic", 50.0),
    ("Cadillac", "Eldorado Biarritz", 1959, "Američki", "classic", 65.0),
    # Njemački
    ("Volkswagen", "Golf GTI Mk1", 1976, "Njemački", "hatch", 15.0),
    ("Audi", "RS2 Avant", 1994, "Njemački", "sedan", 50.0),
    ("BMW", "M3 E46 CSL", 2003, "Njemački", "coupe", 85.0),
    ("BMW", "M3 E30 Sport Evolution", 1990, "Njemački", "coupe", 140.0),
    ("Mercedes-Benz", "190E 2.5-16 Evo II", 1990, "Njemački", "sedan", 160.0),
    ("Porsche", "911 GT3 RS (992)", 2023, "Njemački", "super", 280.0),
    ("Audi", "Sport Quattro S1 E2", 1985, "Rally", "hatch", 600.0),
    ("BMW", "M1", 1978, "Njemački", "super", 700.0),
    ("Mercedes-Benz", "G63 AMG 6x6", 2014, "Njemački", "suv", 750.0),
    ("Porsche", "959", 1987, "Njemački", "super", 1100.0),
    ("Porsche", "911 Carrera RS 2.7", 1973, "Njemački", "classic", 1200.0),
    ("Porsche", "Carrera GT", 2004, "Njemački", "super", 2000.0),
    ("Mercedes-AMG", "One", 2023, "Hypercar", "super", 3500.0),
    ("Mercedes-Benz", "300 SL Gullwing", 1955, "Njemački", "classic", 4500.0),
    # Talijanski
    ("Fiat", "124 Spider", 1972, "Talijanski", "coupe", 12.0),
    ("Alfa Romeo", "Giulia Quadrifoglio", 2020, "Talijanski", "sedan", 60.0),
    ("Lancia", "Delta HF Integrale Evo", 1992, "Rally", "hatch", 65.0),
    ("Lamborghini", "Huracán STO", 2021, "Talijanski", "super", 330.0),
    ("Ferrari", "Testarossa", 1986, "Talijanski", "super", 450.0),
    ("Lancia", "Stratos HF", 1974, "Rally", "coupe", 800.0),
    ("Lamborghini", "Countach LP400", 1974, "Talijanski", "super", 1900.0),
    ("Ferrari", "F40", 1989, "Talijanski", "super", 2200.0),
    ("Lamborghini", "Miura P400 SV", 1971, "Talijanski", "classic", 2800.0),
    ("Maserati", "MC12", 2004, "Talijanski", "super", 3200.0),
    ("Ferrari", "LaFerrari", 2013, "Hypercar", "super", 4000.0),
    ("Pagani", "Zonda R", 2009, "Hypercar", "super", 6000.0),
    ("Alfa Romeo", "33 Stradale", 1967, "Talijanski", "classic", 9000.0),
    ("Ferrari", "250 GTO", 1962, "Talijanski", "classic", 50000.0),
    # Britanski
    ("Mini", "Cooper S", 1965, "Britanski", "classic", 18.0),
    ("Range Rover", "Classic", 1972, "Britanski", "suv", 20.0),
    ("Land Rover", "Defender 90", 1995, "Britanski", "suv", 25.0),
    ("Rolls-Royce", "Phantom", 2018, "Britanski", "sedan", 400.0),
    ("Jaguar", "E-Type Series 1", 1961, "Britanski", "classic", 600.0),
    ("Aston Martin", "DB5", 1964, "Britanski", "classic", 1400.0),
    ("McLaren", "P1", 2013, "Hypercar", "super", 3000.0),
    ("Aston Martin", "Valkyrie", 2021, "Hypercar", "super", 5500.0),
    ("McLaren", "F1", 1992, "Hypercar", "super", 20000.0),
    # Rally
    ("Subaru", "Impreza WRX STI", 2004, "Rally", "sedan", 28.0),
    ("Ford", "Escort RS1600", 1972, "Rally", "classic", 40.0),
    ("Toyota", "Celica GT-Four ST185", 1992, "Rally", "coupe", 55.0),
    ("Citroën", "DS3 WRC", 2011, "Rally", "hatch", 75.0),
    ("Peugeot", "205 T16", 1985, "Rally", "hatch", 900.0),
    # Hyper
    ("Bugatti", "Veyron 16.4", 2005, "Hypercar", "super", 3800.0),
    ("Rimac", "Nevera", 2021, "Hypercar", "super", 4200.0),
    ("Bugatti", "Chiron Super Sport 300+", 2021, "Hypercar", "super", 7000.0),
    ("Koenigsegg", "Jesko Absolut", 2022, "Hypercar", "super", 7500.0),
    ("Mercedes-Benz", "300 SLR Uhlenhaut Coupé", 1955, "Hypercar", "classic", 100000.0),
]

def rarity(v):
    if v < 5: return "common"
    if v < 25: return "uncommon"
    if v < 100: return "rare"
    if v < 500: return "epic"
    if v < 2500: return "legendary"
    return "mythic"

def key(brand, model):
    return f"{brand} {model}"

BY = {key(b, m): i + 1 for i, (b, m, *_r) in enumerate(CARS)}
VAL = {key(b, m): v for (b, m, y, c, bd, v) in CARS}

def find(q):
    hits = [k for k in BY if q.lower() in k.lower()]
    assert len(hits) == 1, (q, hits)
    return hits[0]

# slug, name, description, type, price, gem_price, min_level, streak_min, color, target_ev, [items]
CASES = [
    ("gradska-guzva", "Gradska gužva", "Svakodnevni gradski ljubimci — jeftino i veselo.", "normal", 1.50, None, 0, None, "#38bdf8", 0.92,
     ["Panda", "Polo", "Corsa", "Clio", "206", "Octavia", "Corolla", "EK9", "Golf II", "MX-5", "Fiat 500", "Buba", "GTI Mk1"]),
    ("yugo-nostalgija", "Yu nostalgija", "Fićo, Stojadin, Yugo i ostali junaci naših cesta.", "normal", 2.50, None, 0, None, "#ef4444", 0.92,
     ["Fićo", "Yugo 45", "Stojadin", "Koral", "Trabant", "126p", "Wartburg", "Dacia", "Moskvič", "2107", "Niva", "Katrca", "2CV", "Golf II", "W123", "GTI Mk1", "Mini Cooper"]),
    ("rally-grupa-b", "Rally Grupa B", "Šljunak, skokovi i legende Grupe B.", "normal", 30.0, None, 0, None, "#f59e0b", 0.92,
     ["Niva", "Golf II", "WRX STI", "Escort", "Celica", "Lancer", "Delta HF", "DS3", "22B", "Sport Quattro", "Stratos", "205 T16"]),
    ("jdm-legende", "JDM legende", "Turbo, rotacijski motori i noćne vožnje po Tokiju.", "normal", 40.0, None, 0, None, "#e11d48", 0.92,
     ["EK9", "MX-5", "Silvia", "AE86", "Lancer", "240Z", "RX-7", "Supra", "NSX", "R34", "R35", "22B", "Lexus LFA"]),
    ("britanski-gentleman", "Britanski gentleman", "Čaj u pet, DB5 u garaži.", "normal", 50.0, None, 0, None, "#22c55e", 0.92,
     ["Mini Cooper", "Range Rover", "Defender", "Phantom", "E-Type", "DB5", "McLaren P1", "Valkyrie", "McLaren F1"]),
    ("muscle-amerika", "Muscle Amerika", "V8, dim iz guma i četvrt milje.", "normal", 60.0, None, 0, None, "#3b82f6", 0.92,
     ["Model T", "Crown Victoria", "Wrangler", "Raptor", "Bel Air", "Impala", "Eldorado", "Chevelle", "Camaro", "Demon", "Judge", "Charger", "Corvette", "Boss 429", "Cuda", "Cobra", "GT40"]),
    ("njemacka-preciznost", "Njemačka preciznost", "Autobahn bez ograničenja.", "normal", 80.0, None, 0, None, "#a3a3a3", 0.92,
     ["GTI Mk1", "RS2", "E46", "E30", "190E", "GT3 RS", "Sport Quattro", "BMW M1", "6x6", "959", "RS 2.7", "Carrera GT", "AMG One", "Gullwing"]),
    ("talijanska-strast", "Talijanska strast", "Rosso corsa i zvuk V12 motora.", "normal", 150.0, None, 0, None, "#dc2626", 0.92,
     ["124 Spider", "Giulia", "Delta HF", "Huracán", "Testarossa", "Stratos", "Countach", "F40", "Miura", "MC12", "LaFerrari", "Zonda", "33 Stradale", "250 GTO"]),
    ("zlatno-doba", "Zlatno doba oldtajmera", "Muzejski primjerci za prave kolekcionare.", "normal", 250.0, None, 0, None, "#d4a017", 0.92,
     ["Buba", "Fiat 500", "2CV", "Mini Cooper", "240Z", "Corvette", "E-Type", "RS 2.7", "DB5", "Miura", "Cobra", "Gullwing", "33 Stradale", "250 GTO", "Uhlenhaut"]),
    ("sve-ili-nista", "Sve ili ništa", "Najvjerojatnije Panda. Možda 250 GTO.", "normal", 100.0, None, 0, None, "#7c3aed", 0.90,
     ["Panda", "Fićo", "126p", "Trabant", "206", "Supra", "Cuda", "F40", "LaFerrari", "250 GTO"]),
    ("hypercar-klub", "Hypercar klub", "Samo za one koji ne gledaju cijenu goriva.", "normal", 800.0, None, 0, None, "#f97316", 0.92,
     ["NSX", "GT3 RS", "Lexus LFA", "Testarossa", "Countach", "Carrera GT", "F40", "McLaren P1", "AMG One", "Veyron", "LaFerrari", "Nevera", "Valkyrie", "Zonda", "Chiron", "Jesko", "McLaren F1", "Uhlenhaut"]),
    # Besplatne dnevne kutije (streak)
    ("dnevna-bronca", "Dnevna — bronca", "Besplatno svaki dan (streak 1–2 dana).", "daily", 0, None, 0, 1, "#b45309", 0.80,
     ["Panda", "206", "Fićo", "126p", "Corsa", "Trabant", "Polo", "Clio", "Dacia", "Golf II", "EK9", "GTI Mk1"]),
    ("dnevna-srebro", "Dnevna — srebro", "Besplatno svaki dan (streak 3–5 dana).", "daily", 0, None, 0, 3, "#94a3b8", 1.60,
     ["Panda", "Fićo", "Yugo 45", "Stojadin", "Niva", "2CV", "Golf II", "W123", "GTI Mk1", "Mini Cooper", "Silvia"]),
    ("dnevna-zlato", "Dnevna — zlato", "Besplatno svaki dan (streak 6+ dana).", "daily", 0, None, 0, 6, "#eab308", 3.50,
     ["Fićo", "Stojadin", "Niva", "Golf II", "W123", "MX-5", "GTI Mk1", "Defender", "AE86", "240Z", "Supra"]),
    # Gem stash
    ("gem-garaza", "Gem garaža", "Otključaj gemovima.", "gem", 0, 50, 0, None, "#10b981", 5.0,
     ["Panda", "Golf II", "W123", "EK9", "MX-5", "GTI Mk1", "Mini Cooper", "Silvia", "AE86", "RX-7"]),
    ("gem-salon", "Gem salon", "Otključaj gemovima.", "gem", 0, 250, 0, None, "#06b6d4", 30.0,
     ["MX-5", "GTI Mk1", "Defender", "Silvia", "Escort", "Lancer", "240Z", "RX-7", "Supra", "Charger", "R34", "Testarossa"]),
    ("gem-trezor", "Gem trezor", "Otključaj gemovima.", "gem", 0, 1000, 0, None, "#8b5cf6", 150.0,
     ["Lancer", "RX-7", "Supra", "R34", "22B", "GT3 RS", "Phantom", "E-Type", "BMW M1", "Porsche 959", "F40", "Miura"]),
    # Level kutije
    ("level-5", "Level 5 kutija", "Besplatno svaka 24h od levela 5.", "level", 0, None, 5, None, "#64748b", 2.0,
     ["Panda", "Fićo", "Yugo 45", "Golf II", "W123", "GTI Mk1", "Mini Cooper", "Silvia"]),
    ("level-10", "Level 10 kutija", "Besplatno svaka 24h od levela 10.", "level", 0, None, 10, None, "#0ea5e9", 5.0,
     ["Golf II", "W123", "MX-5", "GTI Mk1", "Defender", "Silvia", "AE86", "240Z"]),
    ("level-20", "Level 20 kutija", "Besplatno svaka 24h od levela 20.", "level", 0, None, 20, None, "#a855f7", 15.0,
     ["MX-5", "GTI Mk1", "Defender", "Escort", "Lancer", "RX-7", "Supra", "R34"]),
    ("level-35", "Level 35 kutija", "Besplatno svaka 24h od levela 35.", "level", 0, None, 35, None, "#ec4899", 40.0,
     ["Defender", "Silvia", "RX-7", "Supra", "R34", "22B", "GT3 RS", "Testarossa", "E-Type"]),
    ("level-50", "Level 50 kutija", "Besplatno svaka 24h od levela 50.", "level", 0, None, 50, None, "#f43f5e", 100.0,
     ["Lancer", "Supra", "R34", "GT3 RS", "Phantom", "E-Type", "BMW M1", "Porsche 959", "F40"]),
]

def weights(vals, target):
    def ev(k):
        w = [v ** -k for v in vals]
        return sum(wi * v for wi, v in zip(w, vals)) / sum(w)
    lo, hi = -5.0, 10.0
    assert min(vals) < target < max(vals), (target, min(vals), max(vals))
    for _ in range(200):
        mid = (lo + hi) / 2
        if ev(mid) > target: lo = mid
        else: hi = mid
    k = (lo + hi) / 2
    w = [v ** -k for v in vals]
    s = sum(w)
    # cijeli brojevi u "ticketima" od 1.000.000 — min 1
    t = [max(1, round(wi / s * 1_000_000)) for wi in w]
    real = sum(ti * v for ti, v in zip(t, vals)) / sum(t)
    return t, real

def q(s):
    return "'" + s.replace("'", "''") + "'"

def sql():
    out = ["-- ===== SEED: automobili =====",
           "insert into public.items (id, brand, model, year, category, body, rarity, value) values"]
    rows = []
    for i, (b, m, y, c, bd, v) in enumerate(CARS):
        rows.append(f"({i+1}, {q(b)}, {q(m)}, {y}, {q(c)}, {q(bd)}, {q(rarity(v))}, {v})")
    out.append(",\n".join(rows) + "\non conflict (id) do update set brand=excluded.brand, model=excluded.model, year=excluded.year, category=excluded.category, body=excluded.body, rarity=excluded.rarity, value=excluded.value;")
    out.append(f"select setval('public.items_id_seq', {len(CARS)});")
    out.append("\n-- ===== SEED: kutije =====")
    report = []
    for idx, (slug, name, desc, typ, price, gem, lvl, streak, color, target, items) in enumerate(CASES):
        keys = [find(x) for x in items]
        assert len(set(keys)) == len(keys), slug
        keys.sort(key=lambda k: VAL[k])
        vals = [VAL[k] for k in keys]
        tgt = price * target if typ == "normal" else target
        t, real = weights(vals, tgt)
        report.append((slug, price, gem, tgt, real))
        out.append(
            f"insert into public.cases (slug, name, description, case_type, price, gem_price, min_level, streak_min, color, sort) values "
            f"({q(slug)}, {q(name)}, {q(desc)}, {q(typ)}, {price}, {gem if gem is not None else 'null'}, {lvl}, {streak if streak is not None else 'null'}, {q(color)}, {idx}) "
            f"on conflict (slug) do update set name=excluded.name, description=excluded.description, case_type=excluded.case_type, price=excluded.price, gem_price=excluded.gem_price, min_level=excluded.min_level, streak_min=excluded.streak_min, color=excluded.color, sort=excluded.sort;")
        out.append(f"delete from public.case_items where case_id = (select id from public.cases where slug={q(slug)});")
        vals_sql = ", ".join(f"({BY[k]}, {ti})" for k, ti in zip(keys, t))
        out.append(f"insert into public.case_items (case_id, item_id, weight) select c.id, v.item_id, v.w from public.cases c, (values {vals_sql}) as v(item_id, w) where c.slug={q(slug)};")
    return "\n".join(out), report

if __name__ == "__main__":
    s, rep = sql()
    open("seed.sql", "w").write(s + "\n")
    for r in rep: print(r)
