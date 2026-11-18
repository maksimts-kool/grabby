/**
 * Grabby's line icons: 24 grid, 1.8 stroke, round caps and joins, drawn in currentColor.
 * Path strings are copied verbatim from the design system's `Icon` component so the
 * web previews and the app never drift. Draw new icons on the same grid.
 */
export const ICON_PATHS = {
  apps: [
    'M5 4.5h4.5a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5z',
    'M14.5 4.5H19a.5.5 0 0 1 .5.5v4.5a.5.5 0 0 1-.5.5h-4.5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5z',
    'M5 14h4.5a.5.5 0 0 1 .5.5V19a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5v-4.5A.5.5 0 0 1 5 14z',
    'M14.5 14H19a.5.5 0 0 1 .5.5V19a.5.5 0 0 1-.5.5h-4.5a.5.5 0 0 1-.5-.5v-4.5a.5.5 0 0 1 .5-.5z',
  ],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  update: [
    'M19.5 10.5A8 8 0 0 0 5.2 7.5',
    'M4.5 4v4h4',
    'M4.5 13.5a8 8 0 0 0 14.3 3',
    'M19.5 20v-4h-4',
  ],
  bell: ['M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z', 'M10 20.5a2 2 0 0 0 4 0'],
  settings: ['M4 7h9', 'M17 7h3', 'M15 5v4', 'M4 17h3', 'M11 17h9', 'M9 15v4'],
  search: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M20 20l-4-4'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  back: ['M15 5l-7 7 7 7'],
  chevron: ['M9 5l7 7-7 7'],
  more: ['M12 5.5v.01', 'M12 12v.01', 'M12 18.5v.01'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  pause: ['M9 5.5v13', 'M15 5.5v13'],
  play: ['M8 5l11 7-11 7z'],
  alert: ['M12 3.5l9 16H3z', 'M12 10v4', 'M12 17v.01'],
  link: [
    'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1',
    'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  ],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  box: ['M12 3l8 4.5v9L12 21l-8-4.5v-9z', 'M4 7.5l8 4.5 8-4.5', 'M12 12v9'],
  wifi: [
    'M2.5 9a14 14 0 0 1 19 0',
    'M5.5 12.5a9.5 9.5 0 0 1 13 0',
    'M8.5 16a5 5 0 0 1 7 0',
    'M12 19.5v.01',
  ],
  trash: ['M5 7h14', 'M10 7V4.5h4V7', 'M7 7l1 13h8l1-13'],
  clock: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
  user: ['M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M4.5 20a7.5 7.5 0 0 1 15 0'],
  shield: ['M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z', 'M8.5 12l2.5 2.5 4.5-4.5'],
  chip: [
    'M7 7h10v10H7z',
    'M10 3.5V7',
    'M14 3.5V7',
    'M10 17v3.5',
    'M14 17v3.5',
    'M3.5 10H7',
    'M3.5 14H7',
    'M17 10h3.5',
    'M17 14h3.5',
  ],
  beta: ['M9 3h6', 'M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3', 'M7.5 15h9'],
  folder: ['M3.5 6.5a1 1 0 0 1 1-1h4.5l2 2h8.5a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z'],
  offline: [
    'M2.5 9a14 14 0 0 1 4.6-2.9',
    'M11 5.5a14 14 0 0 1 10.5 3.5',
    'M5.5 12.5a9.5 9.5 0 0 1 3.7-2.2',
    'M15.5 10.8a9.5 9.5 0 0 1 3 1.7',
    'M8.5 16a5 5 0 0 1 7 0',
    'M12 19.5v.01',
    'M3.5 3.5l17 17',
  ],
  battery: [
    'M4 8h13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
    'M21 11v2',
    'M6.5 11v2',
  ],
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICON_PATHS;
