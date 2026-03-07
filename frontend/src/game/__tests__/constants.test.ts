import { describe, it, expect } from 'vitest';
import { MUTATIONS, POWER_UPS, SKIN_MAP } from '../constants';

describe('Game Constants', () => {
  it('exports MUTATIONS object with correct keys', () => {
    expect(Object.keys(MUTATIONS)).toContain('WINGED');
    expect(Object.keys(MUTATIONS)).toContain('MAGNETIC');
    expect(Object.keys(MUTATIONS)).toContain('HUNTER');
  });

  it('each mutation has name, description, and bonus', () => {
    const mutation = MUTATIONS.WINGED;
    expect(mutation).toHaveProperty('name');
    expect(mutation).toHaveProperty('description');
    expect(mutation).toHaveProperty('bonus');
    expect(mutation.bonus).toHaveProperty('type');
    expect(mutation.bonus).toHaveProperty('value');
  });

  it('exports POWER_UPS with correct keys', () => {
    expect(Object.keys(POWER_UPS)).toContain('SHIELD');
    expect(Object.keys(POWER_UPS)).toContain('MAGNET');
    expect(Object.keys(POWER_UPS)).toContain('FRENZY');
  });

  it('each power-up has name, color, and duration', () => {
    const powerUp = POWER_UPS.SHIELD;
    expect(powerUp).toHaveProperty('name');
    expect(powerUp).toHaveProperty('color');
    expect(powerUp).toHaveProperty('duration');
    expect(typeof powerUp.duration).toBe('number');
    expect(powerUp.duration).toBeGreaterThan(0);
  });

  it('exports SKIN_MAP with valid hex colors', () => {
    const skins = SKIN_MAP;
    expect(Object.keys(skins).length).toBeGreaterThanOrEqual(11);
    Object.values(skins).forEach((color) => {
      expect(typeof color).toBe('string');
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it('WINGED mutation provides speed bonus', () => {
    expect(MUTATIONS.WINGED.bonus.type).toBe('speed');
    expect(MUTATIONS.WINGED.bonus.value).toBeGreaterThan(1);
  });

  it('THICK_SKIN mutation provides boost efficiency', () => {
    expect(MUTATIONS.THICK_SKIN.bonus.type).toBe('boostEfficiency');
    expect(MUTATIONS.THICK_SKIN.bonus.value).toBeLessThan(1);
  });
});
