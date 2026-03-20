import type { PartialTheme } from "@nivo/theming";

/**
 * Shared Nivo theme matching the dark Obsidian Vault design system.
 */
export const nivoTheme: PartialTheme = {
  background: "transparent",
  text: {
    fontSize: 11,
    fill: "oklch(0.55 0.01 80)",
    fontFamily: "'Cascadia Code', 'Fira Code', ui-monospace, monospace",
  },
  axis: {
    domain: {
      line: {
        stroke: "oklch(0.24 0.01 270)",
        strokeWidth: 1,
      },
    },
    ticks: {
      line: {
        stroke: "oklch(0.24 0.01 270)",
        strokeWidth: 1,
      },
      text: {
        fontSize: 11,
        fill: "oklch(0.45 0.01 80)",
        fontFamily: "'Cascadia Code', 'Fira Code', ui-monospace, monospace",
      },
    },
    legend: {
      text: {
        fontSize: 12,
        fill: "oklch(0.55 0.01 80)",
      },
    },
  },
  grid: {
    line: {
      stroke: "oklch(0.2 0.005 270)",
      strokeDasharray: "3 3",
    },
  },
  labels: {
    text: {
      fontSize: 11,
      fill: "oklch(0.88 0.005 80)",
      fontFamily: "'Cascadia Code', 'Fira Code', ui-monospace, monospace",
    },
  },
  legends: {
    text: {
      fontSize: 11,
      fill: "oklch(0.55 0.01 80)",
    },
  },
  tooltip: {
    container: {
      background: "oklch(0.14 0.005 270 / 95%)",
      backdropFilter: "blur(12px)",
      border: "1px solid oklch(1 0 0 / 8%)",
      borderRadius: "0.75rem",
      boxShadow: "0 8px 32px oklch(0 0 0 / 40%)",
      color: "oklch(0.93 0.005 80)",
      fontSize: 12,
      padding: "8px 12px",
    },
  },
};

/**
 * Category color palette for Nivo charts.
 * Vivid, distinct colors matching the design system.
 */
export const categoryPalette = [
  "#34d399", // income/health — emerald
  "#fb923c", // food — orange
  "#60a5fa", // transport/savings — blue
  "#a78bfa", // housing — purple
  "#22d3ee", // utilities — cyan
  "#f472b6", // entertainment — pink
  "#fbbf24", // shopping — amber
  "#818cf8", // education — indigo
  "#2dd4bf", // travel — teal
  "#c084fc", // subscriptions — violet
  "#fb7185", // expense — rose
  "#94a3b8", // other — slate
];
