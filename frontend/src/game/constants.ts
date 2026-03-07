// Shared client-side constants (mutations, power-ups, skins) used for UI and prediction

import { SKINS } from './ProfileManager';

export type MutationBonus = { type: string; value: number };
export type Mutation = { name: string; description: string; bonus: MutationBonus };
export type MutationsMap = Record<string, Mutation>;

export const MUTATIONS: MutationsMap = {
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

export type PowerUp = { name: string; color: string; duration: number };
export type PowerUpsMap = Record<string, PowerUp>;

export const POWER_UPS: PowerUpsMap = {
  SHIELD: { name: 'Invincibility', color: '#00ffff', duration: 10000 },
  MAGNET: { name: 'Super Magnet', color: '#ff00ff', duration: 12000 },
  FRENZY: { name: 'Frenzy Mode', color: '#ff0000', duration: 8000 },
  GHOST: { name: 'Ghost Mode', color: '#ffffff', duration: 10000 },
};

export const SKIN_MAP: Record<string, string> = Object.fromEntries(
  SKINS.map((skin) => [skin.id, skin.baseColor])
) as Record<string, string>;
