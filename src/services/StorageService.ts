import type { Profile } from '../models/Profile';
import { createDefaultProfile, DEFAULT_AVATAR } from '../models/Profile';

const PROFILES_KEY = 'spacemath_profiles';
const PROFILE_PREFIX = 'spacemath_profile_';

interface ProfilesIndex {
  profiles: string[];
  activeProfile: string | null;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const StorageService = {
  getProfilesIndex(): ProfilesIndex {
    const data = localStorage.getItem(PROFILES_KEY);
    if (!data) {
      return { profiles: [], activeProfile: null };
    }
    try {
      return JSON.parse(data);
    } catch {
      return { profiles: [], activeProfile: null };
    }
  },

  saveProfilesIndex(index: ProfilesIndex): void {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(index));
  },

  getAllProfiles(): Profile[] {
    const index = this.getProfilesIndex();
    const profiles: Profile[] = [];

    for (const id of index.profiles) {
      const profile = this.getProfile(id);
      if (profile) {
        profiles.push(profile);
      }
    }

    return profiles;
  },

  getProfile(id: string): Profile | null {
    const data = localStorage.getItem(PROFILE_PREFIX + id);
    if (!data) return null;
    try {
      const profile = JSON.parse(data) as Profile;
      if (!profile.avatar) {
        profile.avatar = DEFAULT_AVATAR;
        this.saveProfile(profile);
      }
      return profile;
    } catch {
      return null;
    }
  },

  saveProfile(profile: Profile): void {
    profile.lastPlayed = Date.now();
    localStorage.setItem(PROFILE_PREFIX + profile.id, JSON.stringify(profile));
  },

  createProfile(name: string, avatar: string = DEFAULT_AVATAR): Profile {
    const id = generateId();
    const profile = createDefaultProfile(id, name, avatar);

    // Save the profile
    this.saveProfile(profile);

    // Update the index
    const index = this.getProfilesIndex();
    index.profiles.push(id);
    if (!index.activeProfile) {
      index.activeProfile = id;
    }
    this.saveProfilesIndex(index);

    return profile;
  },

  deleteProfile(id: string): void {
    // Remove from localStorage
    localStorage.removeItem(PROFILE_PREFIX + id);

    // Update the index
    const index = this.getProfilesIndex();
    index.profiles = index.profiles.filter(p => p !== id);

    // Update active profile if needed
    if (index.activeProfile === id) {
      index.activeProfile = index.profiles[0] || null;
    }

    this.saveProfilesIndex(index);
  },

  setActiveProfile(id: string): void {
    const index = this.getProfilesIndex();
    index.activeProfile = id;
    this.saveProfilesIndex(index);
  },

  getActiveProfile(): Profile | null {
    const index = this.getProfilesIndex();
    if (!index.activeProfile) return null;
    return this.getProfile(index.activeProfile);
  },
};
