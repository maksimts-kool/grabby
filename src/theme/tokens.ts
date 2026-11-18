// Generated from design/tokens.json by scripts/gen-theme.ts — do not edit by hand.
// Run `bun run theme` after changing the tokens.

export const colors = {
  "dark": {
    "bg": "#0e100f",
    "surface": "#171a18",
    "surfaceRaised": "#20241f",
    "line": "#2c312c",
    "lineStrong": "#687168",
    "ink": "#eef1ea",
    "inkMuted": "#9ba39b",
    "lime": "#c6f046",
    "onLime": "#151b00",
    "limeInk": "#c6f046",
    "limeSoft": "#252e10",
    "amber": "#ff9a4d",
    "onAmber": "#2b1300",
    "amberInk": "#ffab6b",
    "amberSoft": "#36230f",
    "danger": "#ff7a7a",
    "dangerSoft": "#3a1717",
    "limeInverse": "#476300",
    "focus": "#c6f046",
    "tileMoss": "#3f6b3a",
    "tileRust": "#a8502f",
    "tileSea": "#2f6b8a",
    "tilePlum": "#6b3f6e",
    "tileSlate": "#3e4752",
    "tileSand": "#c9b07a",
    "onTile": "#f7f8f4",
    "onTileDark": "#14170f"
  },
  "light": {
    "bg": "#f3f4ef",
    "surface": "#ffffff",
    "surfaceRaised": "#e9ebe3",
    "line": "#d6d9cf",
    "lineStrong": "#8a9187",
    "ink": "#121512",
    "inkMuted": "#586058",
    "lime": "#c2ea3f",
    "onLime": "#151b00",
    "limeInk": "#476300",
    "limeSoft": "#e6f4bd",
    "amber": "#ff9a4d",
    "onAmber": "#2b1300",
    "amberInk": "#a14300",
    "amberSoft": "#ffe8d4",
    "danger": "#c42b2b",
    "dangerSoft": "#fde3e1",
    "limeInverse": "#c6f046",
    "focus": "#2f4400",
    "tileMoss": "#3f6b3a",
    "tileRust": "#a8502f",
    "tileSea": "#2f6b8a",
    "tilePlum": "#6b3f6e",
    "tileSlate": "#3e4752",
    "tileSand": "#c9b07a",
    "onTile": "#f7f8f4",
    "onTileDark": "#14170f"
  }
} as const;

export const shadow = {
  "dark": {
    "shadowFloat": "0 8px 24px rgba(0, 0, 0, 0.55)"
  },
  "light": {
    "shadowFloat": "0 8px 24px rgba(18, 21, 18, 0.14)"
  }
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40
} as const;

export const radius = {
  "xs": 6,
  "sm": 10,
  "md": 14,
  "lg": 24,
  "pill": 999
} as const;

export const size = {
  "touchMin": 48,
  "rowMin": 72,
  "topbarH": 64,
  "tabbarH": 80,
  "appiconSm": 40,
  "appiconMd": 48,
  "appiconLg": 72
} as const;

export const type = {
  "display": {
    "fontFamily": "Onest_700Bold",
    "fontSize": 30,
    "lineHeight": 36,
    "letterSpacing": -0.3
  },
  "title": {
    "fontFamily": "Onest_600SemiBold",
    "fontSize": 22,
    "lineHeight": 28
  },
  "headline": {
    "fontFamily": "Onest_600SemiBold",
    "fontSize": 17,
    "lineHeight": 22
  },
  "bodyStrong": {
    "fontFamily": "Onest_600SemiBold",
    "fontSize": 15,
    "lineHeight": 22
  },
  "body": {
    "fontFamily": "Onest_400Regular",
    "fontSize": 15,
    "lineHeight": 22
  },
  "label": {
    "fontFamily": "Onest_600SemiBold",
    "fontSize": 13,
    "lineHeight": 18
  },
  "caption": {
    "fontFamily": "Onest_500Medium",
    "fontSize": 12,
    "lineHeight": 16
  },
  "versionLg": {
    "fontFamily": "JetBrainsMono_600SemiBold",
    "fontSize": 15,
    "lineHeight": 20
  },
  "version": {
    "fontFamily": "JetBrainsMono_500Medium",
    "fontSize": 13,
    "lineHeight": 18
  }
} as const;
