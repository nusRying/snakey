const DOWNLOADABLE_ARENA_PACKS = [
  {
    id: 'event_solar_drift',
    mode: {
      id: 'EVENT_SOLAR_DRIFT',
      name: 'Event: Solar Drift',
      shortDescription: 'Downloaded event pack with long lanes, heat pockets, and portal flanks.',
      ruleSummary: 'Large tactical event board built for aggressive rotations and late-match corridor control.',
      themeLabel: 'Solar drift',
      themeId: 'synth_horizon',
      managedRoom: true,
      preview: {
        width: 100,
        height: 100,
        obstacles: [
          { x: 18, y: 18, width: 12, height: 64 },
          { x: 70, y: 18, width: 12, height: 64 },
          { x: 36, y: 28, width: 28, height: 10 },
          { x: 36, y: 62, width: 28, height: 10 },
        ],
        hazards: [
          { x: 50, y: 18 },
          { x: 50, y: 82 },
        ],
        portals: [
          { x: 12, y: 50 },
          { x: 88, y: 50 },
        ],
      },
    },
    modeConfig: {
      managedRoom: true,
      room: { minPlayers: 2, maxPlayers: 28 },
      world: {
        bounds: { width: 3000, height: 2600 },
        blackHoleCount: 2,
        wormholePairs: 2,
        pelletSpawnCount: 620,
        obstacles: [
          { id: 'solar-left-wall', x: 520, y: 420, width: 180, height: 1760, style: 'vector_gate' },
          { id: 'solar-right-wall', x: 2300, y: 420, width: 180, height: 1760, style: 'vector_gate' },
          { id: 'solar-top-core', x: 1080, y: 720, width: 840, height: 140, style: 'maze_wall' },
          { id: 'solar-bottom-core', x: 1080, y: 1740, width: 840, height: 140, style: 'maze_wall' },
        ],
      },
    },
  },
  {
    id: 'event_glacier_spiral',
    mode: {
      id: 'EVENT_GLACIER_SPIRAL',
      name: 'Event: Glacier Spiral',
      shortDescription: 'Downloaded pack with frozen chokepoints and compact survival routing.',
      ruleSummary: 'A colder event board with spiral blockers, tighter escapes, and punishment for overextension.',
      themeLabel: 'Aurora spiral',
      themeId: 'vector_grid',
      managedRoom: true,
      preview: {
        width: 100,
        height: 100,
        obstacles: [
          { x: 18, y: 18, width: 48, height: 8 },
          { x: 18, y: 18, width: 8, height: 48 },
          { x: 34, y: 34, width: 48, height: 8 },
          { x: 74, y: 34, width: 8, height: 48 },
        ],
        hazards: [
          { x: 24, y: 76 },
          { x: 76, y: 24 },
        ],
        portals: [
          { x: 50, y: 12 },
          { x: 50, y: 88 },
        ],
      },
    },
    modeConfig: {
      managedRoom: true,
      room: { minPlayers: 1, maxPlayers: 24 },
      world: {
        bounds: { width: 2600, height: 2600 },
        blackHoleCount: 2,
        wormholePairs: 1,
        pelletSpawnCount: 660,
        obstacles: [
          { id: 'glacier-top-1', x: 420, y: 420, width: 1240, height: 120, style: 'lcd_bar' },
          { id: 'glacier-left-1', x: 420, y: 420, width: 120, height: 1240, style: 'lcd_bar' },
          { id: 'glacier-top-2', x: 820, y: 820, width: 1240, height: 120, style: 'lcd_bar' },
          { id: 'glacier-right-2', x: 1940, y: 820, width: 120, height: 1240, style: 'lcd_bar' },
        ],
      },
    },
  },
];

module.exports = {
  DOWNLOADABLE_ARENA_PACKS,
};