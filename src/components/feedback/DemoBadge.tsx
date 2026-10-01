import { DEMO_BADGE_LABEL } from "@/lib/constants";

/** Selo obrigatório em blocos com dados fictícios (§142, §187). */
export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      {DEMO_BADGE_LABEL}
    </span>
  );
}
