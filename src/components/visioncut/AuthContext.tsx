"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  avatarColor: string;
  isDemo: boolean;
};

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<CurrentUser | null>;
  login: (email: string, password: string) => Promise<CurrentUser>;
  register: (name: string, email: string, password: string) => Promise<CurrentUser>;
  loginDemo: () => Promise<CurrentUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
      return data.user ?? null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const postJSON = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const login = useCallback(async (email: string, password: string) => {
    const data = await postJSON("/api/auth/login", { email, password });
    setUser(data.user);
    return data.user as CurrentUser;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await postJSON("/api/auth/register", { name, email, password });
    setUser(data.user);
    return data.user as CurrentUser;
  }, []);

  const loginDemo = useCallback(async () => {
    const data = await postJSON("/api/auth/demo", {});
    setUser(data.user);
    return data.user as CurrentUser;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, login, register, loginDemo, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
