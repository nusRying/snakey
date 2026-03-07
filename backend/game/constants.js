// Shared server-side constants for game rules, mutations, power-ups, etc.

const MUTATIONS = {
  WINGED: { name: 'Winged', description: '+15% Speed', bonus: { type: 'speed', value: 1.15 } },
  MAGNETIC: {
    name: 'Magnetic',
    description: '+100% Magnet Range',
    bonus: { type: 'magnetRadius', value: 2.0 },
  },
  GLUTTON: {
    name: 'Glutton',
    description: '+25% Mass from Pellets',
    bonus: { type: 'massGain', value: 1.25 },
  },
  THICK_SKIN: {
    name: 'Thick Skin',
    description: '-30% Boost Drain',
    bonus: { type: 'boostEfficiency', value: 0.7 },
  },
  HUNTER: {
    name: 'Hunter',
    description: '+50% Mass from Kills',
    bonus: { type: 'killBonus', value: 1.5 },
  },
};

const POWER_UPS = {
  SHIELD: { name: 'Invincibility', color: '#00ffff', duration: 10000 },
  MAGNET: { name: 'Super Magnet', color: '#ff00ff', duration: 12000 },
  FRENZY: { name: 'Frenzy Mode', color: '#ff0000', duration: 8000 },
  GHOST: { name: 'Ghost Mode', color: '#ffffff', duration: 10000 },
};

const SKIN_MAP = {
  default: '#00ffcc',
  neon_pink: '#ff4fd8',
  ember_stripe: '#ff8a00',
  metro_sentinel: '#3b82f6',
  phantom_silk: '#f8fafc',
  midnight_vigil: '#0f172a',
  sunforge: '#ffd54a',
  dawn_saber: '#38bdf8',
  storyglow: '#f9a8d4',
  smuggler_flux: '#f97316',
  aurora_coil: '#73f0ff',
  glass_aurora: '#c084fc',
  venom_circuit: '#7dff5a',
  solar_vanguard: '#f43f5e',
  cosmic_drifter: '#5b6cff',
  void_templar: '#312e81',
  riftburn: '#ff5b2e',
  crownspell: '#6d28d9',
  dreamkeep: '#ec4899',
  outrunner_zero: '#e2e8f0',
};

module.exports = { MUTATIONS, POWER_UPS, SKIN_MAP };
