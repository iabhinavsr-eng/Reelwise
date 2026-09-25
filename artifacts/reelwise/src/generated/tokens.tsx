/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#ffffff",
      "foreground": "#171b19",
      "border": "#e5e8e6",
      "card": "#ffffff",
      "cardForeground": "#171b19",
      "popover": "#ffffff",
      "popoverForeground": "#171b19",
      "primary": "#171b19",
      "primaryForeground": "#ffffff",
      "secondary": "#2f7d62",
      "secondaryForeground": "#ffffff",
      "muted": "#f5f7f5",
      "mutedForeground": "#747a77",
      "accent": "#eaf4ef",
      "accentForeground": "#3c6555",
      "destructive": "#b42318",
      "destructiveForeground": "#ffffff",
      "input": "#d9ddda",
      "ring": "#2f7d62",
      "chart1": "#2f7d62",
      "chart2": "#83ad96",
      "chart3": "#c49a62",
      "chart4": "#527f71",
      "chart5": "#947a82",
      "sidebar": "#f7f9f7",
      "sidebarForeground": "#171b19",
      "sidebarBorder": "#e5e8e6",
      "sidebarPrimary": "#2f7d62",
      "sidebarPrimaryForeground": "#ffffff",
      "sidebarAccent": "#eaf4ef",
      "sidebarAccentForeground": "#3c6555",
      "sidebarRing": "#2f7d62"
    },
    "dark": {
      "background": "#141a16",
      "foreground": "#f1f5f2",
      "border": "#343d37",
      "card": "#1b231e",
      "cardForeground": "#f1f5f2",
      "popover": "#1b231e",
      "popoverForeground": "#f1f5f2",
      "primary": "#f1f5f2",
      "primaryForeground": "#171b19",
      "secondary": "#2f7d62",
      "secondaryForeground": "#ffffff",
      "muted": "#252e29",
      "mutedForeground": "#aab5ad",
      "accent": "#20362b",
      "accentForeground": "#c8e3d3",
      "destructive": "#f87171",
      "destructiveForeground": "#2a1111",
      "input": "#343d37",
      "ring": "#75b895",
      "chart1": "#75b895",
      "chart2": "#b4d9c2",
      "chart3": "#d5ad76",
      "chart4": "#79a99a",
      "chart5": "#c79ba5",
      "sidebar": "#19211c",
      "sidebarForeground": "#f1f5f2",
      "sidebarBorder": "#343d37",
      "sidebarPrimary": "#2f7d62",
      "sidebarPrimaryForeground": "#ffffff",
      "sidebarAccent": "#20362b",
      "sidebarAccentForeground": "#c8e3d3",
      "sidebarRing": "#75b895"
    }
  },
  "fontFamily": {
    "sans": [
      "Inter",
      "system-ui",
      "sans-serif"
    ],
    "serif": [
      "Georgia",
      "serif"
    ],
    "mono": [
      "Menlo",
      "monospace"
    ]
  },
  "radius": "0.875rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
