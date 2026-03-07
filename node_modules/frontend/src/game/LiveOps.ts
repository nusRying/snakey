import { getBackendUrl } from '../platform/backend';
import type { ModeDefinition } from './ModeThemes';

export type ArenaPack = {
  id: string;
  name: string;
  summary: string;
  status: string;
};

export type LiveOpsPack = {
  season: string;
  headline: string;
  briefing: string;
  fetchedAt: string;
  arenaPacks: ArenaPack[];
};

const STORAGE_KEY = 'snakey.liveOpsPack';
const ARENA_PACK_STORAGE_KEY = 'snakey.arenaPacks';

export type DownloadableArenaPack = {
  id: string;
  mode: ModeDefinition;
};

export function getCachedLiveOpsPack(): LiveOpsPack | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as LiveOpsPack;
  } catch {
    return null;
  }
}

export async function fetchLiveOpsPack(): Promise<LiveOpsPack | null> {
  try {
    const response = await fetch(getBackendUrl('/api/content-pack'));
    if (!response.ok) {
      throw new Error(`Content pack fetch failed: ${response.status}`);
    }

    const data = (await response.json()) as LiveOpsPack;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    console.warn('LiveOps: unable to fetch content pack', error);
    return getCachedLiveOpsPack();
  }
}

export function getCachedArenaPacks(): DownloadableArenaPack[] {
  try {
    const raw = localStorage.getItem(ARENA_PACK_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DownloadableArenaPack[]) : [];
  } catch {
    return [];
  }
}

export async function fetchArenaPacks(): Promise<DownloadableArenaPack[]> {
  try {
    const response = await fetch(getBackendUrl('/api/arena-packs'));
    if (!response.ok) {
      throw new Error(`Arena pack fetch failed: ${response.status}`);
    }

    const data = (await response.json()) as { packs?: DownloadableArenaPack[] };
    const packs = Array.isArray(data.packs) ? data.packs : [];
    localStorage.setItem(ARENA_PACK_STORAGE_KEY, JSON.stringify(packs));
    return packs;
  } catch (error) {
    console.warn('LiveOps: unable to fetch arena packs', error);
    return getCachedArenaPacks();
  }
}