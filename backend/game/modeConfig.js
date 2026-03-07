const { DOWNLOADABLE_ARENA_PACKS } = require('./arenaPacks');

const BASE_MODE_CONFIGS = {
  FFA: {
    managedRoom: false,
    room: { minPlayers: 1, maxPlayers: 40 },
    world: {
      bounds: { width: 3000, height: 3000 },
      blackHoleCount: 3,
      wormholePairs: 2,
      pelletSpawnCount: 260,
    },
  },
  OFFLINE: {
    managedRoom: false,
    room: { minPlayers: 1, maxPlayers: 1 },
    world: {
      bounds: { width: 3000, height: 3000 },
      blackHoleCount: 1,
      wormholePairs: 1,
      pelletSpawnCount: 220,
    },
  },
  BATTLE_ROYALE: {
    managedRoom: true,
    room: { minPlayers: 2, maxPlayers: 40 },
    world: {
      bounds: { width: 3000, height: 3000 },
      blackHoleCount: 3,
      wormholePairs: 2,
      pelletSpawnCount: 260,
    },
    storm: {
      initialRadius: 2500,
      shrinkPerSecond: 5,
    },
  },
  TEAM_MATCH: {
    managedRoom: true,
    room: { minPlayers: 4, maxPlayers: 40 },
    world: {
      bounds: { width: 3000, height: 3000 },
      blackHoleCount: 3,
      wormholePairs: 2,
      pelletSpawnCount: 260,
    },
  },
  SURVIVAL_LCD: {
    managedRoom: true,
    room: { minPlayers: 1, maxPlayers: 24 },
    world: {
      bounds: { width: 2200, height: 2200 },
      blackHoleCount: 1,
      wormholePairs: 0,
      pelletSpawnCount: 320,
      obstacles: [
        { id: 'lcd-top', x: 330, y: 300, width: 1540, height: 110, style: 'lcd_bar' },
        { id: 'lcd-bottom', x: 330, y: 1790, width: 1540, height: 110, style: 'lcd_bar' },
        { id: 'lcd-left', x: 300, y: 520, width: 110, height: 1160, style: 'lcd_bar' },
        { id: 'lcd-right', x: 1790, y: 520, width: 110, height: 1160, style: 'lcd_bar' },
      ],
    },
  },
  SURVIVAL_ARCADE: {
    managedRoom: true,
    room: { minPlayers: 1, maxPlayers: 24 },
    world: {
      bounds: { width: 2600, height: 2400 },
      blackHoleCount: 4,
      wormholePairs: 1,
      pelletSpawnCount: 300,
      obstacles: [
        { id: 'arcade-hub-top', x: 840, y: 420, width: 920, height: 120, style: 'maze_wall' },
        { id: 'arcade-hub-bottom', x: 840, y: 1860, width: 920, height: 120, style: 'maze_wall' },
        { id: 'arcade-left-pillar', x: 520, y: 760, width: 160, height: 880, style: 'maze_wall' },
        { id: 'arcade-right-pillar', x: 1920, y: 760, width: 160, height: 880, style: 'maze_wall' },
        { id: 'arcade-core', x: 1120, y: 960, width: 360, height: 480, style: 'maze_wall' },
      ],
    },
  },
  SURVIVAL_HANDHELD: {
    managedRoom: true,
    room: { minPlayers: 1, maxPlayers: 24 },
    world: {
      bounds: { width: 2400, height: 2400 },
      blackHoleCount: 2,
      wormholePairs: 1,
      pelletSpawnCount: 320,
      obstacles: [
        { id: 'handheld-dpad-up', x: 360, y: 680, width: 220, height: 620, style: 'pixel_block' },
        { id: 'handheld-dpad-mid', x: 180, y: 880, width: 580, height: 220, style: 'pixel_block' },
        { id: 'handheld-screen-left', x: 1540, y: 520, width: 120, height: 1360, style: 'screen_block' },
        { id: 'handheld-screen-right', x: 1760, y: 520, width: 120, height: 1360, style: 'screen_block' },
        { id: 'handheld-screen-bottom', x: 1420, y: 1640, width: 580, height: 120, style: 'screen_block' },
      ],
    },
  },
  SURVIVAL_KEYPAD: {
    managedRoom: true,
    room: { minPlayers: 1, maxPlayers: 24 },
    world: {
      bounds: { width: 2000, height: 2600 },
      blackHoleCount: 1,
      wormholePairs: 1,
      pelletSpawnCount: 340,
      obstacles: [
        { id: 'keypad-row-1', x: 360, y: 720, width: 1280, height: 100, style: 'keypad_key' },
        { id: 'keypad-row-2', x: 360, y: 1120, width: 1280, height: 100, style: 'keypad_key' },
        { id: 'keypad-row-3', x: 360, y: 1520, width: 1280, height: 100, style: 'keypad_key' },
        { id: 'keypad-col-1', x: 540, y: 560, width: 100, height: 1320, style: 'keypad_key' },
        { id: 'keypad-col-2', x: 950, y: 560, width: 100, height: 1320, style: 'keypad_key' },
        { id: 'keypad-col-3', x: 1360, y: 560, width: 100, height: 1320, style: 'keypad_key' },
      ],
    },
  },
  SURVIVAL_VECTOR: {
    managedRoom: true,
    room: { minPlayers: 1, maxPlayers: 24 },
    world: {
      bounds: { width: 3200, height: 3200 },
      blackHoleCount: 2,
      wormholePairs: 3,
      pelletSpawnCount: 300,
      obstacles: [
        { id: 'vector-top', x: 840, y: 520, width: 1520, height: 120, style: 'vector_gate' },
        { id: 'vector-bottom', x: 840, y: 2560, width: 1520, height: 120, style: 'vector_gate' },
        { id: 'vector-left', x: 520, y: 840, width: 120, height: 1520, style: 'vector_gate' },
        { id: 'vector-right', x: 2560, y: 840, width: 120, height: 1520, style: 'vector_gate' },
        { id: 'vector-center-v', x: 1520, y: 1080, width: 160, height: 1040, style: 'vector_gate' },
        { id: 'vector-center-h', x: 1080, y: 1520, width: 1040, height: 160, style: 'vector_gate' },
      ],
    },
  },
};

const MODE_CONFIGS = {
  ...BASE_MODE_CONFIGS,
  ...Object.fromEntries(DOWNLOADABLE_ARENA_PACKS.map((pack) => [pack.mode.id, pack.modeConfig])),
};

function mergeWorldConfig(modeConfig = {}) {
  const baseWorld = BASE_MODE_CONFIGS.FFA.world;
  const world = modeConfig.world || {};

  return {
    ...baseWorld,
    ...world,
    bounds: {
      ...baseWorld.bounds,
      ...(world.bounds || {}),
    },
  };
}

function getModeConfig(mode = 'FFA') {
  const selected = MODE_CONFIGS[mode] || MODE_CONFIGS.FFA;
  return {
    ...selected,
    room: {
      ...BASE_MODE_CONFIGS.FFA.room,
      ...(selected.room || {}),
    },
    world: mergeWorldConfig(selected),
  };
}

function isSurvivalMode(mode = 'FFA') {
  return mode.startsWith('SURVIVAL_');
}

module.exports = {
  MODE_CONFIGS,
  DOWNLOADABLE_ARENA_PACKS,
  getModeConfig,
  isSurvivalMode,
};