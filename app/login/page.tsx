"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { errMsg } from "@/lib/format";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr(error.message === "Invalid login credentials" ? "Pogrešan email ili lozinka." : errMsg(error));
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
        <div className="checker-strip -mx-6 -mt-6 mb-2 sm:-mx-8 sm:-mt-8" />
        <h1 className="h1">Prijava</h1>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="pw">Lozinka</label>
          <input id="pw" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Prijava..." : "Prijavi se"}</button>
        <p className="text-center text-sm text-muted">
          Nemaš račun? <Link href="/register" className="text-accent hover:underline">Registriraj se</Link>
        </p>
      </form>
    </div>
  );
}
