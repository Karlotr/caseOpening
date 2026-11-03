import { Suspense } from "react";
import { BattleView } from "./BattleView";

export default function Page() {
  return (
    <Suspense fallback={<div className="card h-96 animate-pulse" />}>
      <BattleView />
    </Suspense>
  );
}
