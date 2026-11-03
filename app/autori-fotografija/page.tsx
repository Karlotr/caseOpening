import type { Metadata } from "next";
import { LOCAL_PHOTOS } from "@/lib/carPhoto";

export const metadata: Metadata = { title: "Autori fotografija · GARAŽA.gg" };

// Fotografije su s Wikimedia Commonsa pod slobodnim licencama koje traže navođenje autora.
export default function CreditsPage() {
  const rows = Object.entries(LOCAL_PHOTOS).sort((a, b) => Number(a[0]) - Number(b[0]));
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="h1">Autori fotografija</h1>
      <p className="text-muted">
        Fotografije automobila preuzete su s Wikimedia Commonsa i koriste se pod navedenim licencama. Hvala autorima.
      </p>
      {rows.length === 0 ? (
        <p className="text-muted">Trenutno se ne koriste fotografije.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
          {rows.map(([id, c]) => (
            <li key={id} className="px-4 py-2 text-sm">
              <a href={c.page} className="font-semibold text-accent2 hover:underline" rel="noopener noreferrer" target="_blank">
                {c.title.replace(/^File:/, "")}
              </a>
              <span className="text-muted"> · {c.author} · </span>
              {c.licenseUrl ? (
                <a href={c.licenseUrl} className="hover:underline" rel="noopener noreferrer" target="_blank">{c.license}</a>
              ) : (
                <span>{c.license}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
