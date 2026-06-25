"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo, useCallback } from "react";
import { useProfile } from "./profile-context";

// A simple XP curve logic: Level = floor(sqrt(XP) / n) or something similar
// Let's make it simpler for the game feeling: 100 XP per level.
const XP_PER_LEVEL = 100;

export interface GamificationState {
  xp: number;
  level: number;
  progress: number; // 0 to 100%
  addXp: (amount: number) => void;
  combo: number;
  incrementCombo: () => void;
  resetCombo: () => void;
}

const GamificationContext = createContext<GamificationState>({
  xp: 0,
  level: 1,
  progress: 0,
  addXp: () => {},
  combo: 0,
  incrementCombo: () => {},
  resetCombo: () => {},
});

export function GamificationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { profile } = useProfile();
  
  // In a real app, this would be fetched from/saved to the database.
  // For the clone, we'll store it in localStorage or just keep it in memory.
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);

  useEffect(() => {
    if (globalThis.window !== undefined) {
      const savedXp = localStorage.getItem(`rpg_xp_${profile?.whatsapp_number || 'guest'}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedXp) setXp(Number.parseInt(savedXp, 10));
      
      const savedCombo = localStorage.getItem(`rpg_combo_${profile?.whatsapp_number || 'guest'}`);
      if (savedCombo) setCombo(Number.parseInt(savedCombo, 10));
    }
  }, [profile]);

  const addXp = useCallback((amount: number) => {
    setXp((prev) => {
      const newXp = prev + amount;
      if (globalThis.window !== undefined) {
        localStorage.setItem(`rpg_xp_${profile?.whatsapp_number || 'guest'}`, newXp.toString());
      }
      return newXp;
    });
  }, [profile?.whatsapp_number]);

  const incrementCombo = useCallback(() => {
    setCombo((prev) => {
      const newCombo = prev + 1;
      if (globalThis.window !== undefined) {
        localStorage.setItem(`rpg_combo_${profile?.whatsapp_number || 'guest'}`, newCombo.toString());
      }
      return newCombo;
    });
  }, [profile?.whatsapp_number]);

  const resetCombo = useCallback(() => {
    setCombo(0);
    if (globalThis.window !== undefined) {
      localStorage.setItem(`rpg_combo_${profile?.whatsapp_number || 'guest'}`, '0');
    }
  }, [profile?.whatsapp_number]);

  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInCurrentLevel = xp % XP_PER_LEVEL;
  const progress = (xpInCurrentLevel / XP_PER_LEVEL) * 100;

  const contextValue = useMemo<GamificationState>(
    () => ({ xp, level, progress, addXp, combo, incrementCombo, resetCombo }),
    [xp, level, progress, addXp, combo, incrementCombo, resetCombo]
  );

  return (
    <GamificationContext.Provider value={contextValue}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (context === undefined) {
    throw new Error("useGamification must be used within a GamificationProvider");
  }
  return context;
}
