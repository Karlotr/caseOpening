"use client";

import { useCallback, useEffect, useState } from "react";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/utils/supabase/client";
import { coins, errMsg } from "@/lib/format";
import { useRpc } from "@/lib/useGame";
import { useToast } from "@/components/Toast";
import { RequireAuth } from "@/components/RequireAuth";
import { useCelebrate } from "@/components/WinOverlay";

type Info = { code: string; rate: number; earned_total: number; claimable: number; referrals: number; referral_wagered: number; recent: { username: string; level: number; created_at: string }[] };

export default function AffiliatePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Pozovi prijatelje</h1>
        <p className="mt-2 max-w-2xl text-muted">Podijeli svoj link. Prijatelj dobiva 50 coina pri registraciji, a ti dobivaš postotak od svega što on odigra.</p>
      </div>
      <RequireAuth what="pozivati prijatelje">
        <Affiliate />
      </RequireAuth>
    </div>
  );
}

function Affiliate() {
  const rpc = useRpc();
  const toast = useToast();
  const celebrate = useCelebrate();
  const [info, setInfo] = useState<Info | null>(null);
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await createClient().rpc("affiliate_info");
    if (error) return toast(errMsg(error), "error");
    const d = data as Info;
    setInfo(d);
    setCode(d.code);
  }, [toast]);
  useEffect(() => {
    setOrigin(siteUrl());
    load();
  }, [load]);

  if (!info) return <div className="card h-48 animate-pulse" />;
  const link = `${origin}/register?ref=${info.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("Link je kopiran.", "success");
    } catch {
      toast("Kopiranje nije uspjelo, označi link ručno.", "error");
    }
  };
  const claim = async () => {
    const amt = await rpc<number>("claim_affiliate");
    if (amt !== null) {
      celebrate({ title: "Provizija isplaćena", subtitle: "Affiliate", amount: Number(amt), tier: 1 });
      load();
    }
  };
  const saveCode = async () => {
    const r = await rpc<string>("set_affiliate_code", { p_code: code });
    if (r) {
      toast("Kod je promijenjen.", "success");
      load();
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="link">Tvoj link</label>
          <div className="flex gap-2">
            <input id="link" readOnly className="input font-mono" value={link} onFocus={(e) => e.target.select()} />
            <button className="btn-primary" onClick={copy}>Kopiraj</button>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="code">Kod</label>
          <div className="flex gap-2">
            <input id="code" className="input" value={code} maxLength={20} onChange={(e) => setCode(e.target.value.toLowerCase())} />
            <button className="btn-ghost whitespace-nowrap" onClick={saveCode} disabled={code === info.code}>Spremi kod</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat l="Pozvanih" v={String(info.referrals)} />
          <Stat l="Oni su odigrali" v={coins(info.referral_wagered)} />
          <Stat l="Tvoja provizija" v={`${(Number(info.rate) * 100).toFixed(1).replace(".", ",")}%`} />
        </div>
      </div>
      <div className="card flex flex-col p-5">
        <div className="text-sm text-muted">Spremno za isplatu</div>
        <div className="font-display text-6xl font-black text-accent">{coins(info.claimable)}</div>
        <div className="text-sm text-muted">Ukupno zarađeno: {coins(info.earned_total)}</div>
        <button className="btn-primary mt-4 self-start px-6 py-3 text-lg" disabled={Number(info.claimable) < 1} onClick={claim}>Isplati na račun</button>
        <div className="mt-5 border-t border-line pt-3">
          <div className="mb-2 font-display text-xl font-bold">Zadnji pozvani</div>
          {info.recent.length === 0 ? (
            <p className="text-sm text-muted">Još nitko. Pošalji link u chat ili prijateljima.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {info.recent.map((r) => (
                <li key={r.username} className="flex justify-between">
                  <span>{r.username} <span className="text-muted">· level {r.level}</span></span>
                  <span className="text-muted">{new Date(r.created_at).toLocaleDateString("hr-HR")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return (
    <div className="rounded-lg bg-ink/60 p-3">
      <div className="text-xs text-muted">{l}</div>
      <div className="font-display text-2xl font-bold">{v}</div>
    </div>
  );
}
