// Fotografije automobila:
//  1) lokalne (public/cars/, skinute s Wikimedia Commonsa skriptom `npm run car-photos`)
//  2) opcionalno CarImages API (NEXT_PUBLIC_CARIMAGES_KEY) za aute bez lokalne slike
//  3) inače crtež (CarArt)
import type { Item } from "./types";
import local from "./car-photos.json";

export type PhotoCredit = { file: string; cutout?: boolean; title: string; page: string; author: string; license: string; licenseUrl: string | null };
export const LOCAL_PHOTOS = local as Record<string, PhotoCredit>;
export const isCutout = (id: number) => !!LOCAL_PHOTOS[String(id)]?.cutout;
export const localPhoto = (id: number) => (LOCAL_PHOTOS[String(id)] ? `/cars/${LOCAL_PHOTOS[String(id)].file}` : null);

const KEY = process.env.NEXT_PUBLIC_CARIMAGES_KEY;
export const photosEnabled = !!KEY || Object.keys(LOCAL_PHOTOS).length > 0;

// Nazivi u našem katalogu → nazivi koje API prepoznaje (nadimci i šifre šasija maknuti)
const MODEL: Record<string, { make?: string; model: string }> = {
  '750 "Fićo"': { model: "750" },
  "Koral In": { model: "Koral" },
  '126p "Peglica"': { model: "126" },
  "412": { make: "Moskvich", model: "412" },
  "Niva 4x4": { model: "Niva" },
  "Golf II": { model: "Golf" },
  "W123 240D": { model: "W123" },
  "Corsa C": { model: "Corsa" },
  "Clio II": { model: "Clio" },
  "Octavia RS": { model: "Octavia" },
  "Buba 1200": { model: "Beetle" },
  "Civic Type R EK9": { model: "Civic Type R" },
  "MX-5 NA": { model: "MX-5" },
  "Silvia S15": { model: "Silvia" },
  "AE86 Sprinter Trueno": { model: "Sprinter Trueno" },
  "Lancer Evo VI TME": { model: "Lancer Evolution" },
  "RX-7 FD": { model: "RX-7" },
  "Supra MK4": { model: "Supra" },
  "NSX NA1": { model: "NSX" },
  "Skyline GT-R R34": { model: "Skyline GT-R" },
  "GT-R R35 Nismo": { model: "GT-R" },
  "Impreza 22B STi": { model: "Impreza" },
  "Wrangler YJ": { model: "Wrangler" },
  "F-150 Raptor": { model: "F-150" },
  "Impala SS": { model: "Impala" },
  "Eldorado Biarritz": { model: "Eldorado" },
  "Chevelle SS 454": { model: "Chevelle" },
  "Camaro Z/28": { model: "Camaro" },
  "Challenger SRT Demon 170": { model: "Challenger" },
  "Charger R/T": { model: "Charger" },
  "Corvette C2 Sting Ray": { model: "Corvette" },
  "Mustang Boss 429": { model: "Mustang" },
  "Hemi 'Cuda": { model: "Barracuda" },
  "Cobra 427": { model: "Cobra" },
  "GT40 MkII": { model: "GT40" },
  "Golf GTI Mk1": { model: "Golf" },
  "RS2 Avant": { model: "RS2" },
  "M3 E46 CSL": { model: "M3" },
  "M3 E30 Sport Evolution": { model: "M3" },
  "190E 2.5-16 Evo II": { model: "190" },
  "911 GT3 RS (992)": { model: "911" },
  "Sport Quattro S1 E2": { model: "Quattro" },
  "G63 AMG 6x6": { model: "G-Class" },
  "911 Carrera RS 2.7": { model: "911" },
  "300 SL Gullwing": { model: "300 SL" },
  "Giulia Quadrifoglio": { model: "Giulia" },
  "Delta HF Integrale Evo": { model: "Delta" },
  "Huracán STO": { model: "Huracan" },
  "Stratos HF": { model: "Stratos" },
  "Countach LP400": { model: "Countach" },
  "Miura P400 SV": { model: "Miura" },
  "Zonda R": { model: "Zonda" },
  "33 Stradale": { model: "33" },
  "Cooper S": { model: "Cooper" },
  Classic: { make: "Land Rover", model: "Range Rover" },
  "Defender 90": { model: "Defender" },
  "E-Type Series 1": { model: "E-Type" },
  "Impreza WRX STI": { model: "Impreza" },
  "Escort RS1600": { model: "Escort" },
  "Celica GT-Four ST185": { model: "Celica" },
  "DS3 WRC": { model: "DS3" },
  "205 T16": { model: "205" },
  "Veyron 16.4": { model: "Veyron" },
  "Chiron Super Sport 300+": { model: "Chiron" },
  "Jesko Absolut": { model: "Jesko" },
  "300 SLR Uhlenhaut Coupé": { model: "300 SLR" },
};

export const photoSource = (i: Pick<Item, "id">) => (localPhoto(i.id) ? "lokalna" : KEY ? "CarImages API" : "crtež");

export function photoQuery(i: Pick<Item, "brand" | "model" | "year">) {
  const o = MODEL[i.model];
  const clean = i.model.replace(/"[^"]*"/g, "").replace(/\([^)]*\)/g, "").trim();
  return { make: o?.make ?? i.brand, model: o?.model ?? clean, year: i.year };
}

// Mala sličica (300px, public/cars/sm) za trake koje se vrte — puno manje za dekodirati i iscrtati na mobitelu
export function thumbUrl(i: Pick<Item, "id" | "brand" | "model" | "year">) {
  const f = LOCAL_PHOTOS[String(i.id)]?.file;
  return f ? `/cars/sm/${f}` : photoUrl(i);
}

// Jedna širina svugdje → preglednik i CDN keširaju istu sliku (manje zahtjeva prema kvoti)
export function photoUrl(i: Pick<Item, "id" | "brand" | "model" | "year">) {
  const l = localPhoto(i.id);
  if (l) return l;
  if (!KEY) return null;
  const q = photoQuery(i);
  const p = new URLSearchParams({ make: q.make, model: q.model, year: String(q.year), width: "480", format: "webp", key: KEY });
  return `https://carimagesapi.com/image?${p.toString()}`;
}
