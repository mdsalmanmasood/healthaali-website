/**
 * Inline SVG icon set.
 *
 * Hand-authored 24×24 stroke icons (currentColor, no fill) so the site ships
 * zero icon fonts / icon packages and nothing extra to download. Add new icons
 * here rather than importing a library.
 */

export const icons = {
  /* ---------- brand / nature -------------------------------------------- */
  leaf: '<path d="M20.5 3.5C10.5 3.5 4 8.6 4 15.2A3.8 3.8 0 0 0 7.8 19c6.6 0 11.7-6.5 11.7-16.5Z"/><path d="M13.5 10.5 4.8 19.2"/>',

  /* ---------- food ------------------------------------------------------- */
  /** Fork and knife, aligned to a shared baseline so it reads at 20–24px. */
  utensils:
    '<path d="M6.5 3v18"/><path d="M3.5 3v6a3 3 0 0 0 6 0V3"/><path d="M17.5 3c-1.7 1.4-2.8 3.6-2.8 6.2 0 2.3 1 4 2.8 4.3V21"/>',
  /** A rice bowl — reads better than cutlery for "recipes". */
  bowl: '<path d="M3.5 10.5h17a8.5 8.5 0 0 1-17 0Z"/><path d="M9 7.5c0-1.4 1.6-1.6 1.6-3"/><path d="M14 7.5c0-1.4 1.6-1.6 1.6-3"/>',
  /** Clock with a rewind arrow — "it remembers". */
  history:
    '<path d="M3.6 12a8.4 8.4 0 1 0 2.6-6.1"/><path d="M3.6 4.6V10H9"/><path d="M12 8.2V12l3 1.8"/>',
  droplet: '<path d="M12 3s6 6.2 6 10.2A6 6 0 0 1 6 13.2C6 9.2 12 3 12 3Z"/>',
  flame:
    '<path d="M12 21a6 6 0 0 0 6-6c0-4.5-6-12-6-12S6 10.5 6 15a6 6 0 0 0 6 6Z"/><path d="M12 21a2.6 2.6 0 0 0 2.6-2.6c0-2-2.6-4.9-2.6-4.9s-2.6 2.9-2.6 4.9A2.6 2.6 0 0 0 12 21Z"/>',
  scale:
    '<path d="M12 4v3"/><path d="M5 7h14"/><path d="M5 7 2 15h6Z"/><path d="M19 7l3 8h-6Z"/><path d="M12 7v13"/>',
  heart:
    '<path d="M12 20.4 4.6 13a4.7 4.7 0 0 1 6.6-6.7l.8.8.8-.8A4.7 4.7 0 0 1 19.4 13Z"/>',
  target:
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',

  /* ---------- data / tracking ------------------------------------------- */
  chart:
    '<path d="M4 4v16h16"/><path d="M8 16v-4"/><path d="M12.5 16V8"/><path d="M17 16v-6"/>',
  gauge:
    '<path d="M4.6 18a9 9 0 1 1 14.8 0"/><path d="M12 14.5 15.8 10"/><circle cx="12" cy="15" r="1.4"/>',
  clipboard:
    '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9.5 4V3h5v1"/><path d="M9 10h6"/><path d="M9 14h6"/><path d="M9 18h3"/>',
  list: '<path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',

  /* ---------- intelligence ---------------------------------------------- */
  sparkles:
    '<path d="M11 3.5 12.8 8.7 18 10.5 12.8 12.3 11 17.5 9.2 12.3 4 10.5 9.2 8.7Z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
  brain:
    '<path d="M12 5a3 3 0 0 0-5.6-1.4A2.7 2.7 0 0 0 4.2 7a2.7 2.7 0 0 0 .5 3.6A2.9 2.9 0 0 0 6.2 16 2.9 2.9 0 0 0 12 18Z"/><path d="M12 5a3 3 0 0 1 5.6-1.4A2.7 2.7 0 0 1 19.8 7a2.7 2.7 0 0 1-.5 3.6A2.9 2.9 0 0 1 17.8 16 2.9 2.9 0 0 1 12 18Z"/>',

  /* ---------- devices / actions ----------------------------------------- */
  smartphone:
    '<rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M10.8 18.6h2.4"/>',
  monitor:
    '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8.5 20.5h7"/><path d="M12 17v3.5"/>',
  camera:
    '<path d="M4 8.5h3l1.8-2h6.4l1.8 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.4"/>',
  barcode:
    '<path d="M4 5v14"/><path d="M7.5 5v14"/><path d="M11 5v10"/><path d="M14 5v14"/><path d="M17 5v10"/><path d="M20 5v14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M18 9A6 6 0 0 0 6 9c0 6-2.2 7.5-2.2 7.5h16.4S18 15 18 9Z"/><path d="M10.4 20a2 2 0 0 0 3.2 0"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  upload: '<path d="M12 16V4.5"/><path d="M7.5 9 12 4.5 16.5 9"/><path d="M4.5 20h15"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8.5 3v4"/><path d="M15.5 3v4"/>',
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5S14.4 18.1 12 20.5c-2.4-2.4-3.6-5.3-3.6-8.5S9.6 5.9 12 3.5Z"/>',

  /* ---------- security --------------------------------------------------- */
  shield: '<path d="M12 3.2 19 6v6c0 4.6-2.9 7.8-7 9.2-4.1-1.4-7-4.6-7-9.2V6Z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',

  /* ---------- people / settings ----------------------------------------- */
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-4 3.6-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.8c2.3.6 3.9 2.2 3.9 4.4"/>',
  settings:
    '<path d="M4 7h9"/><path d="M17 7h3"/><path d="M4 17h5"/><path d="M13 17h7"/><circle cx="15" cy="7" r="2.2"/><circle cx="11" cy="17" r="2.2"/>',

  /* ---------- ui --------------------------------------------------------- */
  check: '<path d="m20 6.5-11 11-5-5"/>',
  arrowRight: '<path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/>',
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M9.5 7H17v7.5"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2"/><path d="M12 19.5v2"/><path d="M2.5 12h2"/><path d="M19.5 12h2"/><path d="m5.2 5.2 1.4 1.4"/><path d="m17.4 17.4 1.4 1.4"/><path d="m5.2 18.8 1.4-1.4"/><path d="m17.4 6.6 1.4-1.4"/>',
  moon: '<path d="M20.5 13.4A8.6 8.6 0 1 1 10.6 3.5a6.9 6.9 0 0 0 9.9 9.9Z"/>',
  monitorSmall:
    '<rect x="2.5" y="4.5" width="19" height="12.5" rx="2"/><path d="M9 20.5h6"/><path d="M12 17v3.5"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.5"/><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none"/>',
  play: '<path d="M8 5.2v13.6L19 12Z"/>',
} as const;

export type IconName = keyof typeof icons;
