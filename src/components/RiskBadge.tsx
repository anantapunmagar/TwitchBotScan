import type { RiskLevel } from "../types";

const CONFIG: Record<RiskLevel, { label: string; bg: string; text: string; border: string; glow: string }> = {
  clean:    { label: "Clean",    bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30", glow: "shadow-emerald-500/20" },
  low:      { label: "Low Risk", bg: "bg-sky-500/15",     text: "text-sky-300",     border: "border-sky-500/30",     glow: "shadow-sky-500/20"     },
  medium:   { label: "Medium",   bg: "bg-amber-500/15",   text: "text-amber-300",   border: "border-amber-500/30",   glow: "shadow-amber-500/20"   },
  high:     { label: "High",     bg: "bg-orange-500/15",  text: "text-orange-300",  border: "border-orange-500/30",  glow: "shadow-orange-500/20"  },
  critical: { label: "Critical", bg: "bg-red-500/15",     text: "text-red-300",     border: "border-red-500/30",     glow: "shadow-red-500/20"     },
};

interface RiskBadgeProps {
  level: RiskLevel;
  size?: "sm" | "md" | "lg";
}

export default function RiskBadge({ level, size = "md" }: RiskBadgeProps) {
  const c = CONFIG[level];
  const sz =
    size === "sm" ? "text-xs px-2 py-0.5" :
    size === "lg" ? "text-sm px-4 py-1.5 font-bold" :
    "text-xs px-3 py-1 font-semibold";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${c.bg} ${c.text} ${c.border} shadow-md ${c.glow} ${sz} uppercase tracking-wide`}
    >
      <span className={`w-1.5 h-1.5 rounded-full bg-current animate-pulse`} />
      {c.label}
    </span>
  );
}

export function riskColor(level: RiskLevel): string {
  return CONFIG[level].text;
}

export function riskGradient(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    clean:    "from-emerald-500 to-teal-600",
    low:      "from-sky-500 to-blue-600",
    medium:   "from-amber-500 to-orange-500",
    high:     "from-orange-500 to-red-500",
    critical: "from-red-500 to-rose-700",
  };
  return map[level];
}
