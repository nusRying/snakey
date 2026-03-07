import { describe, expect, it } from 'vitest';
import { getModeDefinition, isManagedMode, resolveThemeId } from '../ModeThemes';

describe('ModeThemes', () => {
  it('returns survival definitions with fixed themes', () => {
    const mode = getModeDefinition('SURVIVAL_LCD');

    expect(mode.name).toContain('LCD');
    expect(mode.managedRoom).toBe(true);
    expect(resolveThemeId({ mode: 'SURVIVAL_LCD', level: 99 })).toBe('retro_lcd');
  });

  it('keeps classic modes level reactive', () => {
    expect(isManagedMode('BATTLE_ROYALE')).toBe(true);
    expect(isManagedMode('FFA')).toBe(false);
    expect(resolveThemeId({ mode: 'FFA', level: 3 })).toBe('retro_lcd');
    expect(resolveThemeId({ mode: 'FFA', level: 22 })).toBe('vector_grid');
  });
});