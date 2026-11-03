"use client";

import Link from "next/link";
import { siteUrl } from "@/lib/site";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { errMsg } from "@/lib/format";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}/auth/confirm?next=/nova-lozinka`,
    });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    setSent(true);
  };

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
        <div className="checker-strip -mx-6 -mt-6 mb-2 sm:-mx-8 sm:-mt-8" />
        <h1 className="h1">Zaboravljena lozinka</h1>
        {sent ? (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-950/50 p-3 text-sm text-emerald-300">
            Ako račun s tim emailom postoji, poslali smo link za novu lozinku. Otvori ga na ovom ili bilo kojem uređaju.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">Upiši email s kojim si se registrirao i poslat ćemo ti link za postavljanje nove lozinke.</p>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            {err && <p className="text-sm text-red-400">{err}</p>}
            <button className="btn-primary w-full" disabled={busy}>{busy ? "Šaljem…" : "Pošalji link"}</button>
          </>
        )}
        <p className="text-center text-sm text-muted">
          <Link href="/login" className="text-accent2 hover:underline">Natrag na prijavu</Link>
        </p>
      </form>
    </div>
  );
}
