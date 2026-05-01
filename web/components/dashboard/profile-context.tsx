"use client";

import React, { createContext, useContext, ReactNode } from "react";

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
}

const ProfileContext = createContext<ProfileContextProps>({
  profile: null,
});

export function ProfileProvider({
  children,
  profile,
}: {
  children: ReactNode;
  profile: UserProfile | null;
}) {
  return (
    <ProfileContext.Provider value={{ profile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
