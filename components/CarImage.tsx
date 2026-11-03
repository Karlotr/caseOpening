"use client";

import { useState } from "react";
import type { Body, Item, Rarity } from "@/lib/types";
import { photoUrl } from "@/lib/carPhoto";
import { CarArt } from "./CarArt";

type Car = Pick<Item, "id" | "brand" | "model" | "year" | "body" | "rarity"> & { photo?: boolean };

// Prava fotografija ako je uključena (ključ + item.photo), inače crtež. Na grešku se vraća crtež.
export function CarImage({ item, className = "" }: { item: Car; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = item.photo === false || failed ? null : photoUrl(item);
  if (!url) return <CarArt id={item.id} body={item.body as Body} rarity={item.rarity as Rarity} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${item.brand} ${item.model}`}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  );
}
