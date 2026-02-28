export const SKINS = [
  { id: 'default', name: 'Classic Snek', requiredLevel: 1, baseColor: '#00ffcc' },
  { id: 'neon_pink', name: 'Neon Pink', requiredLevel: 2, baseColor: '#ff00ff' },
  { id: 'tiger', name: 'Tiger Snek', requiredLevel: 5, baseColor: '#ff8800' },
  { id: 'ghost', name: 'Spooky Snek', requiredLevel: 10, baseColor: '#ffffff' },
  { id: 'gold', name: 'Golden Mamba', requiredLevel: 20, baseColor: '#ffd700' },
];

export class ProfileManager {
  static getProfile() {
    console.log('ProfileManager: getProfile called');
    const defaultProfile = {
      name: 'Player',
      xp: 0,

      level: 1,
      selectedSkin: 'default',
      unlockedSkins: ['default']
    };

    // localStorage may not exist in some environments (SSR, tests, incognito)
    if (typeof localStorage === 'undefined' || localStorage === null) {
      console.warn('ProfileManager: localStorage unavailable, using default profile');
      return defaultProfile;
    }
    
    try {
      const stored = localStorage.getItem('snakey_profile');
      if (stored) {
        const parsed = JSON.parse(stored);
        // guard in case JSON.parse returns null/undefined
        if (parsed && typeof parsed === 'object') {
          // Recalculate level just in case
          parsed.level = this.calculateLevel(parsed.xp);
          
          // Ensure unlocked skins are correct for level
          parsed.unlockedSkins = SKINS.filter(s => s.requiredLevel <= parsed.level).map(s => s.id);
          
          // Validate selected skin
          if (!parsed.unlockedSkins.includes(parsed.selectedSkin)) {
              parsed.selectedSkin = 'default';
          }

          return { ...defaultProfile, ...parsed };
        }
      }
    } catch(e) {
      console.error('Error reading profile', e);
      try { localStorage.removeItem('snakey_profile'); } catch {} // wipe bad data
    }
    return defaultProfile;
  }

  static saveProfile(profile) {
    localStorage.setItem('snakey_profile', JSON.stringify(profile));
  }

  static calculateLevel(xp) {
    // Basic curve: 1000 XP per level
    return Math.floor(Math.sqrt(xp / 500)) + 1;
  }

  static getLevelProgress(xp) {
    const currentLevel = this.calculateLevel(xp);
    const xpForCurrent = 500 * Math.pow(currentLevel - 1, 2);
    const xpForNext = 500 * Math.pow(currentLevel, 2);
    
    return {
       currentLevel,
       xpIntoLevel: xp - xpForCurrent,
       xpRequired: xpForNext - xpForCurrent,
       percent: ((xp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100
    };
  }

  static addXP(amount) {
    const p = this.getProfile();
    const oldLevel = p.level;
    
    p.xp += amount;
    p.level = this.calculateLevel(p.xp);
    
    // Check unlocks
    const newUnlocks = SKINS.filter(s => s.requiredLevel <= p.level).map(s => s.id);
    p.unlockedSkins = newUnlocks;
    
    this.saveProfile(p);
    
    return {
        leveledUp: p.level > oldLevel,
        newLevel: p.level,
        profile: p
    };
  }

  /**
   * Completely wipes the stored profile and returns the default object.
   * Useful for debugging or recovering from corrupted storage.
   */
  static resetProfile() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage !== null) {
        localStorage.removeItem('snakey_profile');
      }
    } catch (e) {
      console.warn('ProfileManager.resetProfile: could not clear localStorage', e);
    }
    return this.getProfile();
  }
}
