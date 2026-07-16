"use client";

// GERÇEK KİMLİK DOĞRULAMA DEĞİL. Supabase Auth bağlanana kadar
// "giriş yapmış kullanıcı" kavramını UI'da göstermek için localStorage'a
// yazılan bir simülasyon — şifre yok, herhangi bir e-posta değeri
// mock-data.ts'teki listeyle eşleşiyorsa "oturum" açılır. Bu bir güvenlik
// sınırı DEĞİLDİR (bkz. CLAUDE.md "Mevcut aşama").
import { createContext, useContext, useState, type ReactNode } from "react";
import { mockProfiles } from "./mock-data";
import type { Profile } from "./types";

const SESSION_KEY = "kalkan-os-session-v1";

interface AuthApi {
  currentUser: Profile | null;
  login: (email: string) => { ok: boolean; error: string | null };
  logout: () => void;
}

const AuthContext = createContext<AuthApi | null>(null);

function loadSession(): Profile | null {
  if (typeof window === "undefined") return null;
  const userId = window.localStorage.getItem(SESSION_KEY);
  if (!userId) return null;
  return mockProfiles.find((p) => p.id === userId) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Profile | null>(loadSession);

  function login(email: string): { ok: boolean; error: string | null } {
    const profile = mockProfiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
    if (!profile) {
      return { ok: false, error: "Bu e-posta ile eşleşen bir demo kullanıcı yok." };
    }
    window.localStorage.setItem(SESSION_KEY, profile.id);
    setCurrentUser(profile);
    return { ok: true, error: null };
  }

  function logout() {
    window.localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth, AuthProvider içinde kullanılmalı");
  return ctx;
}
