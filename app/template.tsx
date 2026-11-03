// Svaka navigacija lagano "izroni" (blur + pomak) — prijelaz između stranica
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
