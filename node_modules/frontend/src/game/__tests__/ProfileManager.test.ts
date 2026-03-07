import { beforeEach, describe, expect, it } from 'vitest';
import { ProfileManager, getDailyRewardStatus, getSkinById } from '../ProfileManager';

describe('ProfileManager progression systems', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('completes match challenges and unlocks challenge skins', () => {
    const result = ProfileManager.addXP(1200, {
      xpEarned: 1200,
      matchKills: 5,
      maxMass: 1900,
    });

    expect(result.newChallenges).toContain('shadow_stalker');
    expect(result.newChallenges).toContain('skybreaker');
    expect(result.newUnlocks).toContain('midnight_vigil');
    expect(result.newUnlocks).toContain('solar_vanguard');

    const profile = ProfileManager.getProfile();
    expect(profile.completedChallenges).toContain('shadow_stalker');
    expect(profile.completedChallenges).toContain('skybreaker');
    expect(profile.unlockedSkins).toContain('midnight_vigil');
    expect(profile.unlockedSkins).toContain('solar_vanguard');
  });

  it('tracks cumulative challenge progress across matches', () => {
    ProfileManager.addXP(300, { xpEarned: 300, matchKills: 10, maxMass: 600 });
    ProfileManager.addXP(300, { xpEarned: 300, matchKills: 15, maxMass: 900 });
    ProfileManager.addXP(300, { xpEarned: 300, matchKills: 25, maxMass: 1100 });

    const profile = ProfileManager.getProfile();
    expect(profile.stats.totalKills).toBe(50);
    expect(profile.completedChallenges).toContain('star_forge');
    expect(profile.unlockedSkins).toContain('void_templar');
  });

  it('claims daily rewards with streak unlocks', () => {
    ProfileManager.claimDailyReward(new Date('2026-01-01T09:00:00'));
    ProfileManager.claimDailyReward(new Date('2026-01-02T09:00:00'));
    const thirdDay = ProfileManager.claimDailyReward(new Date('2026-01-03T09:00:00'));

    expect(thirdDay.claimed).toBe(true);
    expect(thirdDay.newUnlocks).toContain('smuggler_flux');

    ProfileManager.claimDailyReward(new Date('2026-01-04T09:00:00'));
    const fifthDay = ProfileManager.claimDailyReward(new Date('2026-01-05T09:00:00'));
    expect(fifthDay.newUnlocks).toContain('glass_aurora');

    const profile = ProfileManager.getProfile();
    expect(profile.dailyRewards.streak).toBe(5);
    expect(profile.dailyRewards.bestStreak).toBe(5);
    expect(profile.unlockedSkins).toContain('smuggler_flux');
    expect(profile.unlockedSkins).toContain('glass_aurora');
  });

  it('reports daily claim status and falls back to default skin lookup', () => {
    const profile = ProfileManager.getProfile();
    const status = getDailyRewardStatus(profile, new Date('2026-02-10T10:00:00'));

    expect(status.canClaim).toBe(true);
    expect(status.nextStreak).toBe(1);
    expect(status.reward.xp).toBeGreaterThan(0);
    expect(getSkinById('missing_skin').id).toBe('default');
  });
});