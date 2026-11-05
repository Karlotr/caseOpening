"use client";

import { useState } from "react";
import type { Body, Item, Rarity } from "@/lib/types";
import { isCutout, localPhoto, photoUrl } from "@/lib/carPhoto";
import { CarArt } from "./CarArt";

type Car = Pick<Item, "id" | "brand" | "model" | "year" | "body" | "rarity"> & { photo?: boolean };

// Prava fotografija ako je uključena (ključ + item.photo), inače crtež. Na grešku se vraća crtež.
export function CarImage({ item, className = "", reflect = false, eager = false }: { item: Car; className?: string; reflect?: boolean; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const url = item.photo === false || failed ? null : photoUrl(item);
  if (!url) return <CarArt id={item.id} body={item.body as Body} rarity={item.rarity as Rarity} className={className} />;
  // lokalne fotografije s pozadinom prikaži uokvireno; izrezane (prozirne) slobodno, sa sjenom
  const framed = !!localPhoto(item.id) && !isCutout(item.id);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${item.brand} ${item.model}`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={`${framed ? "rounded-md object-cover shadow-[0_6px_16px_rgba(0,0,0,.5)] ring-1 ring-white/10" : "object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,.6)]"} ${reflect && !framed ? "reflect" : ""} ${className}`}
    />
  );
}

// Učitaj i dekodiraj slike unaprijed (npr. traka prije vrtnje), da se ne učitavaju usred animacije — to je trzalo na mobitelu.
// Čeka najviše `maxMs`, pa animacija nikad ne kasni puno.
export function preloadCars(items: Car[], maxMs = 700): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const urls = [...new Set(items.map((i) => (i.photo === false ? null : photoUrl(i))).filter(Boolean) as string[])];
  const jobs = urls.map((u) => {
    const img = new Image();
    img.decoding = "async";
    img.src = u;
    return img.decode().catch(() => undefined);
  });
  return Promise.race([Promise.all(jobs).then(() => undefined), new Promise<void>((r) => setTimeout(r, maxMs))]);
}
