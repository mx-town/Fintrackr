/**
 * Map hex colors to Tremor named colors.
 * Tremor's `colors` prop expects names like "blue", "emerald", etc.
 * Inline CSS (e.g. legend dots) can still use raw hex.
 */

const HEX_TO_TREMOR: Record<string, string> = {
  "#22c55e": "green",
  "#f97316": "orange",
  "#fb923c": "amber",
  "#3b82f6": "blue",
  "#8b5cf6": "violet",
  "#06b6d4": "cyan",
  "#ec4899": "pink",
  "#a855f7": "purple",
  "#f59e0b": "yellow",
  "#10b981": "emerald",
  "#6366f1": "indigo",
  "#14b8a6": "teal",
  "#f472b6": "rose",
  "#94a3b8": "slate",
  "#64748b": "gray",
  "#ef4444": "red",
  "#84cc16": "lime",
  "#0ea5e9": "sky",
  "#d946ef": "fuchsia",
  "#f43f5e": "rose",
  "#fb7185": "rose",
  "#60a5fa": "blue",
};

export function hexToTremorColor(hex: string | null): string {
  if (!hex) return "slate";
  return HEX_TO_TREMOR[hex.toLowerCase()] ?? "slate";
}
