"use client";

import Link from "next/link";
import { siteUrl } from "@/lib/site";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { errMsg } from "@/lib/format";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => {
    try {
      setRef(localStorage.getItem("garaza-ref"));
    } catch {}
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return setErr("Korisničko ime: 3–20 znakova (slova, brojevi, _).");
    if (password.length < 6) return setErr("Lozinka mora imati barem 6 znakova.");
    if (password !== password2) return setErr("Lozinke se ne podudaraju.");
    setBusy(true);
    const sb = createClient();
    const { data: free } = await sb.rpc("username_available", { p_username: username });
    if (free === false) {
      setBusy(false);
      return setErr("Korisničko ime je zauzeto.");
    }
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: ref ? { username, ref } : { username }, emailRedirectTo: `${siteUrl()}/auth/confirm` },
    });
    setBusy(false);
    if (error) return setErr(errMsg(error));
    if (!data.session) {
      setInfo("Račun je kreiran! Provjeri email i potvrdi registraciju, zatim se prijavi.");
      return;
    }
    router.push("/rewards");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="card space-y-4 p-6 sm:p-8">
        <div className="checker-strip -mx-6 -mt-6 mb-2 sm:-mx-8 sm:-mt-8" />
        <h1 className="h1">Registracija</h1>
        <p className="text-sm text-muted">Dobivaš <span className="text-accent">1.000 virtualnih coina</span> i besplatnu dnevnu kutiju.</p>
        {ref && (
          <p className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
            Pozvao te <b>{ref}</b>: dobivaš dodatnih 50 coina.
          </p>
        )}
        <div>
          <label className="label" htmlFor="u">Korisničko ime</label>
          <input id="u" required className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pw">Lozinka</label>
            <input id="pw" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="pw2">Ponovi</label>
            <input id="pw2" type="password" required className="input" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
          </div>
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
        {info && <p className="rounded-md border border-emerald-500/40 bg-emerald-950/50 p-3 text-sm text-emerald-300">{info}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Kreiram račun..." : "Kreiraj račun"}</button>
        <p className="text-center text-sm text-muted">
          Već imaš račun? <Link href="/login" className="text-accent hover:underline">Prijavi se</Link>
        </p>
      </form>
    </div>
  );
}
