"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { errMsg } from "@/lib/format";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";

// Postavljanje nove lozinke — nakon linka iz emaila (sesija za oporavak) ili iz profila
export default function NewPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (pw.length < 6) return setErr("Lozinka mora imati barem 6 znakova.");
    if (pw !== pw2) return setErr("Lozinke se ne podudaraju.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    toast("Lozinka je promijenjena.", "success");
    router.push("/");
  };

  if (loading) return <div className="card mx-auto h-60 max-w-md animate-pulse" />;
  if (!user)
    return (
      <div className="card mx-auto max-w-md space-y-3 p-8 text-center">
        <h1 className="h1">Link je istekao</h1>
        <p className="text-muted">Link za novu lozinku više ne vrijedi ili je već iskorišten. Zatraži novi.</p>
        <Link href="/zaboravljena-lozinka" className="btn-primary">Pošalji novi link</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
        <div className="checker-strip -mx-6 -mt-6 mb-2 sm:-mx-8 sm:-mt-8" />
        <h1 className="h1">Nova lozinka</h1>
        <p className="text-sm text-muted">Račun: {user.email}</p>
        <div>
          <label className="label" htmlFor="pw">Nova lozinka</label>
          <input id="pw" type="password" required className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="pw2">Ponovi lozinku</label>
          <input id="pw2" type="password" required className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Spremam…" : "Spremi lozinku"}</button>
      </form>
    </div>
  );
}
