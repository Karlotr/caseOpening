#!/usr/bin/env node
// Skida fotografije automobila s Wikimedia Commonsa (slobodne licence) u public/cars/
// i zapisuje autora + licencu u lib/car-photos.json (prikazuje se na /autori-fotografija).
//
//   npm run car-photos                 # skine sve što još nema
//   npm run car-photos -- --force      # skine ponovno sve
//   npm run car-photos -- --only=4,16  # samo određeni id-ovi (s --force za zamjenu)
//   npm run car-photos -- --dry        # samo ispiše što bi odabrao
//
// Izvori po autu su u scripts/car-photo-sources.json (wiki / search / file).
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "cars");
const MANIFEST = path.join(ROOT, "lib", "car-photos.json");
const SOURCES = path.join(ROOT, "scripts", "car-photo-sources.json");
const WIKI = process.env.WIKI_API ?? "https://en.wikipedia.org/w/api.php";
const COMMONS = process.env.COMMONS_API ?? "https://commons.wikimedia.org/w/api.php";
const WIDTH = 800;
// Wikimedia traži opisni User-Agent s kontaktom
const UA = process.env.WIKI_UA ?? "GarazaGG-car-photos/1.0 (hobby project; https://github.com/Karlotr/caseOpening)";

const args = process.argv.slice(2);
const force = args.includes("--force");
const dry = args.includes("--dry");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",").map((s) => s.trim()).filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);
const strip = (html) => (html ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, " ").trim();
const BAD = /(interior|engine|motor|logo|badge|emblem|dashboard|cockpit|seat|wheel|rim|steering|interieur|\.svg$|\.pdf$|\.tif|diagram|map|kofferraum|trunk|detail)/i;

async function api(base, params) {
  const u = new URL(base);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", origin: "*", ...params })) u.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(u, { headers: { "User-Agent": UA, "Api-User-Agent": UA } });
    if (r.status === 429 || r.status >= 500) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${u}`);
    return r.json();
  }
  throw new Error(`Previše pokušaja: ${u}`);
}

// naslovna slika Wikipedia članka → naziv datoteke na Commonsu
async function fileFromWiki(title) {
  const j = await api(WIKI, { action: "query", prop: "pageimages", piprop: "name", titles: title, redirects: 1 });
  const name = j?.query?.pages?.[0]?.pageimage;
  return name ? `File:${name}` : null;
}

// pretraga na Commonsu (samo datoteke), preskače interijere, logotipe i sl.
async function fileFromSearch(q) {
  const j = await api(COMMONS, { action: "query", list: "search", srsearch: `${q} filetype:bitmap`, srnamespace: 6, srlimit: 15 });
  const hits = (j?.query?.search ?? []).map((h) => h.title).filter((t) => /\.(jpe?g|png|webp)$/i.test(t) && !BAD.test(t));
  return hits[0] ?? null;
}

async function info(fileTitle) {
  const j = await api(COMMONS, { action: "query", titles: fileTitle, prop: "imageinfo", iiprop: "url|extmetadata|mime", iiurlwidth: WIDTH });
  const p = j?.query?.pages?.[0];
  const ii = p?.imageinfo?.[0];
  if (!ii) return null;
  const m = ii.extmetadata ?? {};
  return {
    title: p.title,
    url: ii.thumburl ?? ii.url,
    page: ii.descriptionurl,
    author: strip(m.Artist?.value) || "Nepoznat autor",
    license: strip(m.LicenseShortName?.value) || "vidi izvor",
    licenseUrl: m.LicenseUrl?.value ?? null,
    mime: ii.thumbmime ?? ii.mime,
  };
}

async function main() {
  const sources = JSON.parse(await readFile(SOURCES, "utf8"));
  const manifest = (await exists(MANIFEST)) ? JSON.parse(await readFile(MANIFEST, "utf8")) : {};
  await mkdir(OUT_DIR, { recursive: true });
  const ids = Object.keys(sources).filter((k) => /^\d+$/.test(k) && (!only || only.includes(k)));
  let ok = 0, skipped = 0, failed = [];

  for (const id of ids) {
    const src = sources[id];
    if (!force && manifest[id] && (await exists(path.join(OUT_DIR, manifest[id].file)))) {
      skipped++;
      continue;
    }
    try {
      let file = src.file ? (src.file.startsWith("File:") ? src.file : `File:${src.file}`) : null;
      if (!file && src.wiki) file = await fileFromWiki(src.wiki);
      if (!file && src.search) file = await fileFromSearch(src.search);
      if (!file && src.wiki) file = await fileFromSearch(src.wiki);
      if (!file) throw new Error("nema rezultata");
      const meta = await info(file);
      if (!meta?.url) throw new Error(`nema URL-a za ${file}`);
      const ext = meta.mime === "image/png" ? "png" : meta.mime === "image/webp" ? "webp" : "jpg";
      const name = `${id}.${ext}`;
      console.log(`#${id.padStart(3)}  ${meta.title}  [${meta.license}]`);
      if (!dry) {
        const r = await fetch(meta.url, { headers: { "User-Agent": UA } });
        if (!r.ok) throw new Error(`download ${r.status}`);
        await writeFile(path.join(OUT_DIR, name), Buffer.from(await r.arrayBuffer()));
        manifest[id] = { file: name, title: meta.title, page: meta.page, author: meta.author, license: meta.license, licenseUrl: meta.licenseUrl };
      }
      ok++;
    } catch (e) {
      failed.push(id);
      console.warn(`#${id.padStart(3)}  NIJE USPJELO: ${e.message}`);
    }
    await sleep(350); // budi pristojan prema Wikimedia API-ju
  }

  if (!dry) {
    const sorted = Object.fromEntries(Object.entries(manifest).sort((a, b) => Number(a[0]) - Number(b[0])));
    await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + "\n");
  }
  console.log(`\nGotovo: ${ok} skinuto, ${skipped} već postoji, ${failed.length} neuspjelo${failed.length ? ` (${failed.join(",")})` : ""}.`);
  if (failed.length) console.log("Za neuspjele upiši 'file' u scripts/car-photo-sources.json i pokreni: npm run car-photos -- --only=" + failed.join(","));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
