"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function RequireAuth({ children, what = "igrati" }: { children: React.ReactNode; what?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="card h-40 animate-pulse" />;
  if (!user)
    return (
      <div className="card flex flex-col items-center gap-3 p-10 text-center">
        <span className="checker h-10 w-10 rounded" />
        <div className="font-display text-lg font-semibold">Prijavi se da bi mogao {what}</div>
        <p className="max-w-sm text-sm text-muted">Novi vozači dobivaju 1.000 virtualnih coina za početak.</p>
        <div className="flex gap-2">
          <Link href="/login" className="btn-ghost">Prijava</Link>
          <Link href="/register" className="btn-primary">Registracija</Link>
        </div>
      </div>
    );
  return <>{children}</>;
}
