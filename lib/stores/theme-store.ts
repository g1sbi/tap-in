/**
 * Theme Store (Zustand)
 * 
 * Global state management for app theming and visual settings.
 * Persisted to AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ColorPalette, ColorPaletteName } from '../home-background-config';
import { colorPalettes } from '../home-background-config';

const STORAGE_KEY = 'tap-in-theme';
const DEFAULT_THEME: ColorPaletteName = 'cyan-magenta';

interface ThemeState {
  theme: ColorPaletteName;
  reduceAnimations: boolean;
  isHydrated: boolean;
}

interface ThemeActions {
  setTheme: (theme: ColorPaletteName) => void;
  setReduceAnimations: (reduce: boolean) => void;
  setHydrated: (hydrated: boolean) => void;
}

interface ThemeStore extends ThemeState, ThemeActions {
  // Computed getter (not stored, derived from theme)
  colors: ColorPalette;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      // State
      theme: DEFAULT_THEME,
      reduceAnimations: false,
      isHydrated: false,

      // Computed
      get colors() {
        return colorPalettes[get().theme];
      },

      // Actions
      setTheme: (theme) => set({ theme }),
      setReduceAnimations: (reduce) => set({ reduceAnimations: reduce }),
      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        theme: state.theme,
        reduceAnimations: state.reduceAnimations,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

// Selector hooks for optimized re-renders
export const useTheme = () => useThemeStore((state) => state.theme);
export const useColors = () => {
  const theme = useThemeStore((state) => state.theme);
  return colorPalettes[theme];
};
export const useReduceAnimations = () => useThemeStore((state) => state.reduceAnimations);
export const useThemeHydrated = () => useThemeStore((state) => state.isHydrated);

// Action hooks
export const useThemeActions = () => useThemeStore((state) => ({
  setTheme: state.setTheme,
  setReduceAnimations: state.setReduceAnimations,
}));

