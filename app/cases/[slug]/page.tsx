import { Suspense } from "react";
import { CaseView } from "./CaseView";

export default function Page() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <CaseView />
    </Suspense>
  );
}
