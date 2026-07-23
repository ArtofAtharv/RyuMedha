"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { getAppClient } from "@/lib/supabase-client";

export interface UserProfile {
  id: string;
  whatsapp_number: string;
  display_name: string;
  academics_enabled: boolean;
  personal_enabled: boolean;
  target_attendance_pct: number;
  current_university_id?: string | null;
  current_program_id?: string | null;
  current_semester_id?: string | null;
  setup_completed?: boolean;
  is_admin?: boolean;
  last_user_message_at?: string;
  timezone?: string;
}

interface ProfileContextProps {
  profile: UserProfile | null;
  activeTrack: 'academics' | 'personal';
  setActiveTrack: (track: 'academics' | 'personal') => void;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextProps>({
  profile: null,
  activeTrack: 'academics',
  setActiveTrack: () => {},
  refreshProfile: async () => {},
});

export function ProfileProvider({
  children,
  profile: initialProfile = null,
}: {
  children: ReactNode;
  profile?: UserProfile | null;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [activeTrack, setActiveTrack] = useState<'academics' | 'personal'>('academics');

  const fetchProfile = async () => {
    try {
      const supabase = getAppClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .single();
      if (!error && data) {
        setProfile(data as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Error fetching profile in context:", err);
      setProfile(null);
    }
  };

  useEffect(() => {
    if (initialProfile) {
      setTimeout(() => setProfile(initialProfile), 0);
    } else {
      setTimeout(() => fetchProfile(), 0);
    }
  }, [initialProfile]);

  useEffect(() => {
    const supabase = getAppClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setTimeout(() => fetchProfile(), 0);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (profile) {
      if (profile.academics_enabled && !profile.personal_enabled) {
        setTimeout(() => setActiveTrack("academics"), 0);
      } else if (!profile.academics_enabled && profile.personal_enabled) {
        setTimeout(() => setActiveTrack("personal"), 0);
      }
    }
  }, [profile, profile?.academics_enabled, profile?.personal_enabled]);

  return (
    <ProfileContext.Provider value={{ profile, activeTrack, setActiveTrack, refreshProfile: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
