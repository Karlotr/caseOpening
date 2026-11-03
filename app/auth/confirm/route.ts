import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

// Link iz emaila za potvrdu → potvrdi račun, postavi sesiju (cookie) i odmah prijavi korisnika.
// Podržava oba formata:
//  - ?token_hash=...&type=email   (preporučeni email template, radi i na drugom uređaju)
//  - ?code=...                    (default Supabase PKCE redirect, isti preglednik)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/rewards";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/rewards";

  const supabase = createClient(await cookies());
  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const dest = new URL(ok ? safeNext : "/login?potvrda=neuspjela", url.origin);
  if (ok) dest.searchParams.set("dobrodosli", "1");
  return NextResponse.redirect(dest);
}
