export type ThemePreset = {
  id: string;
  label: string;
  baseFill: string;
  gridColor: string;
  boundsColor: string;
  accent: string;
  accentSoft: string;
};

export type ArenaPreviewObstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ArenaPreviewPoint = {
  x: number;
  y: number;
};

export type ArenaPreview = {
  width: number;
  height: number;
  obstacles?: ArenaPreviewObstacle[];
  hazards?: ArenaPreviewPoint[];
  portals?: ArenaPreviewPoint[];
};

export type ModeDefinition = {
  id: string;
  name: string;
  shortDescription: string;
  ruleSummary: string;
  themeLabel: string;
  themeId?: string;
  managedRoom: boolean;
  preview: ArenaPreview;
};

const BASE_MODE_OPTIONS: ModeDefinition[] = [
  {
    id: 'FFA',
    name: 'Free-For-All',
    shortDescription: 'Endless growth with level-reactive arena moods.',
    ruleSummary: 'Classic open hunt. Your background theme shifts with your overall account level.',
    themeLabel: 'Level reactive',
    managedRoom: false,
    preview: {
      width: 100,
      height: 100,
      hazards: [
        { x: 26, y: 32 },
        { x: 74, y: 68 },
      ],
      portals: [
        { x: 20, y: 74 },
        { x: 82, y: 28 },
      ],
    },
  },
  {
    id: 'BATTLE_ROYALE',
    name: 'Battle Royale',
    shortDescription: 'Shrinking safe zone and sudden endgame pressure.',
    ruleSummary: 'Managed round with storm pressure and last-coil-standing finish.',
    themeLabel: 'Level reactive',
    managedRoom: true,
    preview: {
      width: 100,
      height: 100,
      hazards: [
        { x: 30, y: 35 },
        { x: 66, y: 64 },
      ],
      portals: [
        { x: 20, y: 78 },
        { x: 82, y: 22 },
      ],
    },
  },
  {
    id: 'TEAM_MATCH',
    name: 'Team Deathmatch',
    shortDescription: 'Mass races with red-vs-blue scoreboard pressure.',
    ruleSummary: 'Managed round built around team score accumulation and control.',
    themeLabel: 'Level reactive',
    managedRoom: true,
    preview: {
      width: 100,
      height: 100,
      obstacles: [{ x: 47, y: 10, width: 6, height: 80 }],
      hazards: [{ x: 50, y: 50 }],
      portals: [
        { x: 18, y: 18 },
        { x: 82, y: 82 },
      ],
    },
  },
  {
    id: 'SURVIVAL_LCD',
    name: 'Survival: LCD Labyrinth',
    shortDescription: 'Monochrome lanes inspired by early pocket-screen snake eras.',
    ruleSummary: 'Tight board, minimal wormholes, and dense pellet routing for pure survival runs.',
    themeLabel: 'Retro LCD',
    themeId: 'retro_lcd',
    managedRoom: true,
    preview: {
      width: 100,
      height: 100,
      obstacles: [
        { x: 15, y: 12, width: 70, height: 7 },
        { x: 15, y: 81, width: 70, height: 7 },
        { x: 12, y: 24, width: 7, height: 52 },
        { x: 81, y: 24, width: 7, height: 52 },
      ],
      hazards: [{ x: 50, y: 50 }],
    },
  },
  {
    id: 'SURVIVAL_ARCADE',
    name: 'Survival: Neon Cabinet',
    shortDescription: 'Arcade-floor glow with louder hazards and brighter trails.',
    ruleSummary: 'Mid-size arena with heavier hazard density and a crowded cabinet-energy look.',
    themeLabel: 'Neon arcade',
    themeId: 'arcade_maze',
    managedRoom: true,
    preview: {
      width: 100,
      height: 100,
      obstacles: [
        { x: 28, y: 18, width: 44, height: 8 },
        { x: 28, y: 74, width: 44, height: 8 },
        { x: 16, y: 34, width: 8, height: 36 },
        { x: 76, y: 34, width: 8, height: 36 },
        { x: 43, y: 42, width: 14, height: 18 },
      ],
      hazards: [
        { x: 18, y: 18 },
        { x: 82, y: 18 },
        { x: 18, y: 82 },
        { x: 82, y: 82 },
      ],
      portals: [
        { x: 10, y: 50 },
        { x: 90, y: 50 },
      ],
    },
  },
  {
    id: 'SURVIVAL_HANDHELD',
    name: 'Survival: Pixel Pocket',
    shortDescription: 'Soft pixel tiles and compact handheld-era pacing.',
    ruleSummary: 'Square map rhythm with a balanced hazard mix and classic pick-up flow.',
    themeLabel: 'Pixel handheld',
    themeId: 'pixel_handheld',
    managedRoom: true,
    preview: {
      width: 100,
      height: 100,
      obstacles: [
        { x: 14, y: 29, width: 11, height: 28 },
        { x: 6, y: 38, width: 28, height: 11 },
        { x: 64, y: 20, width: 6, height: 56 },
        { x: 74, y: 20, width: 6, height: 56 },
        { x: 59, y: 66, width: 26, height: 6 },
      ],
      hazards: [
        { x: 50, y: 24 },
        { x: 50, y: 82 },
      ],
      portals: [
        { x: 42, y: 50 },
        { x: 89, y: 50 },
      ],
    },
  },
  {
    id: 'SURVIVAL_KEYPAD',
    name: 'Survival: Keypad Rush',
    shortDescription: 'Late-night phone-era glow with compressed lanes and fast loops.',
    ruleSummary: 'Lean arena, quicker pellet churn, and direct movement lines made for short intense rounds.',
    themeLabel: 'Keypad phone',
    themeId: 'brick_phone',
    managedRoom: true,
    preview: {
      width: 100,
      height: 100,
      obstacles: [
        { x: 18, y: 28, width: 64, height: 6 },
        { x: 18, y: 46, width: 64, height: 6 },
        { x: 18, y: 64, width: 64, height: 6 },
        { x: 28, y: 18, width: 6, height: 58 },
        { x: 47, y: 18, width: 6, height: 58 },
        { x: 66, y: 18, width: 6, height: 58 },
      ],
      hazards: [{ x: 50, y: 84 }],
      portals: [
        { x: 12, y: 12 },
        { x: 88, y: 88 },
      ],
    },
  },
  {
    id: 'SURVIVAL_VECTOR',
    name: 'Survival: Vector Grid',
    shortDescription: 'Wireframe minimalism pulled from early web and terminal snake revivals.',
    ruleSummary: 'Large tactical board with extra portals and a colder, precision-first feel.',
    themeLabel: 'Vector web',
    themeId: 'vector_grid',
    managedRoom: true,
    preview: {
      width: 100,
      height: 100,
      obstacles: [
        { x: 24, y: 14, width: 52, height: 6 },
        { x: 24, y: 80, width: 52, height: 6 },
        { x: 14, y: 24, width: 6, height: 52 },
        { x: 80, y: 24, width: 6, height: 52 },
        { x: 48, y: 32, width: 6, height: 36 },
        { x: 32, y: 48, width: 36, height: 6 },
      ],
      hazards: [
        { x: 20, y: 20 },
        { x: 80, y: 20 },
      ],
      portals: [
        { x: 20, y: 80 },
        { x: 80, y: 80 },
        { x: 50, y: 12 },
      ],
    },
  },
];

export let MODE_OPTIONS: ModeDefinition[] = [...BASE_MODE_OPTIONS];

export const SURVIVAL_MODE_IDS = BASE_MODE_OPTIONS.filter((mode) => mode.id.startsWith('SURVIVAL_')).map(
  (mode) => mode.id
);

const THEME_PRESETS: Record<string, ThemePreset> = {
  retro_lcd: {
    id: 'retro_lcd',
    label: 'Retro LCD',
    baseFill: '#1d2b1f',
    gridColor: 'rgba(172, 255, 145, 0.12)',
    boundsColor: '#b7ff7a',
    accent: '#d8ff9c',
    accentSoft: 'rgba(216, 255, 156, 0.16)',
  },
  arcade_maze: {
    id: 'arcade_maze',
    label: 'Neon Arcade',
    baseFill: '#080b1c',
    gridColor: 'rgba(0, 242, 255, 0.12)',
    boundsColor: '#ff4d7d',
    accent: '#00f2ff',
    accentSoft: 'rgba(0, 242, 255, 0.15)',
  },
  pixel_handheld: {
    id: 'pixel_handheld',
    label: 'Pixel Handheld',
    baseFill: '#13293d',
    gridColor: 'rgba(148, 210, 189, 0.12)',
    boundsColor: '#94d2bd',
    accent: '#e9d8a6',
    accentSoft: 'rgba(233, 216, 166, 0.14)',
  },
  brick_phone: {
    id: 'brick_phone',
    label: 'Keypad Phone',
    baseFill: '#151129',
    gridColor: 'rgba(110, 231, 255, 0.11)',
    boundsColor: '#38bdf8',
    accent: '#f59e0b',
    accentSoft: 'rgba(245, 158, 11, 0.14)',
  },
  vector_grid: {
    id: 'vector_grid',
    label: 'Vector Grid',
    baseFill: '#081018',
    gridColor: 'rgba(94, 234, 212, 0.13)',
    boundsColor: '#5eead4',
    accent: '#e2e8f0',
    accentSoft: 'rgba(226, 232, 240, 0.14)',
  },
  synth_horizon: {
    id: 'synth_horizon',
    label: 'Synth Horizon',
    baseFill: '#090814',
    gridColor: 'rgba(192, 132, 252, 0.11)',
    boundsColor: '#fb7185',
    accent: '#c084fc',
    accentSoft: 'rgba(192, 132, 252, 0.14)',
  },
};

let MODE_LOOKUP = Object.fromEntries(MODE_OPTIONS.map((mode) => [mode.id, mode]));

function refreshModeRegistry() {
  MODE_LOOKUP = Object.fromEntries(MODE_OPTIONS.map((mode) => [mode.id, mode]));
}

export function registerDownloadedModes(modes: ModeDefinition[] = []) {
  const next = [...BASE_MODE_OPTIONS];
  for (const mode of modes) {
    if (!mode || !mode.id) continue;
    if (next.find((entry) => entry.id === mode.id)) continue;
    next.push(mode);
  }
  MODE_OPTIONS = next;
  refreshModeRegistry();
}

export function getModeOptions(): ModeDefinition[] {
  return MODE_OPTIONS;
}

export function getModeDefinition(mode = 'FFA'): ModeDefinition {
  return MODE_LOOKUP[mode] || MODE_LOOKUP.FFA;
}

export function isManagedMode(mode = 'FFA'): boolean {
  return getModeDefinition(mode).managedRoom;
}

export function getThemePreset(themeId = 'arcade_maze'): ThemePreset {
  return THEME_PRESETS[themeId] || THEME_PRESETS.arcade_maze;
}

export function getLevelThemeId(level = 1): string {
  if (level < 5) return 'retro_lcd';
  if (level < 10) return 'arcade_maze';
  if (level < 15) return 'pixel_handheld';
  if (level < 20) return 'brick_phone';
  if (level < 28) return 'vector_grid';
  return 'synth_horizon';
}

export function resolveThemeId({ mode = 'FFA', level = 1 }: { mode?: string; level?: number }): string {
  const modeDefinition = getModeDefinition(mode);
  if (modeDefinition.themeId) {
    return modeDefinition.themeId;
  }

  return getLevelThemeId(level);
}