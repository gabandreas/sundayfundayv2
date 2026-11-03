"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  AuthenticatedUser,
  AuthResponse,
  LifeStagePreset,
  UiDensityMode,
  loginUser,
  loginDemoUser,
  registerMember,
  fetchMe,
  resetDemoSandbox,
  refreshSessionToken,
} from "@/lib/api";

interface AuthContextType {
  user: AuthenticatedUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  remainingSeconds: number;
  isSessionExpiring: boolean;
  refreshSession: () => Promise<void>;
  login: (payload: {
    accountName?: string;
    username?: string;
    email?: string;
    password: string;
    securityPin?: string;
    trustIp?: boolean;
    ipLabel?: string;
  }) => Promise<AuthResponse>;
  demoLogin: () => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    lifeStagePreset?: LifeStagePreset;
    uiDensityMode?: UiDensityMode;
    initialSalary?: number;
    dailyLivingBudget?: number;
    coreSavingsTarget?: number;
  }) => Promise<void>;
  resetDemo: () => Promise<void>;
  logout: (isExpired?: boolean) => void;
  switchAccount: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const parsed = JSON.parse(json);
    return parsed.exp ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

function syncCookies(user: AuthenticatedUser | null, token: string | null) {
  if (typeof window === "undefined") return;
  if (user && token) {
    localStorage.setItem("erp_auth_token", token);
    localStorage.setItem("erp_auth_user", JSON.stringify(user));
    const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `erp_user_id=${user.id}; path=/; max-age=2592000; SameSite=Lax${secureFlag}`;
    document.cookie = `erp_auth_token=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax${secureFlag}`;
  } else {
    localStorage.removeItem("erp_auth_token");
    localStorage.removeItem("erp_auth_user");
    document.cookie = "erp_user_id=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "erp_auth_token=; path=/; max-age=0; SameSite=Lax";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800);

  const userRef = useRef<AuthenticatedUser | null>(null);
  userRef.current = user;

  const logout = useCallback(
    (isExpired = false) => {
      const activeUser = userRef.current;
      if (isExpired && activeUser) {
        try {
          localStorage.setItem(
            "erp_locked_identity",
            JSON.stringify({
              accountName: activeUser.accountName,
              username: activeUser.username,
              fullName: activeUser.fullName,
              role: activeUser.role,
            })
          );
        } catch {}
      } else if (!isExpired) {
        localStorage.removeItem("erp_locked_identity");
      }
      setUser(null);
      setToken(null);
      setExpiresAt(null);
      setRemainingSeconds(0);
      syncCookies(null, null);
      if (isExpired) {
        router.replace("/login?expired=1");
      } else {
        router.replace("/login");
      }
    },
    [router]
  );

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;
    const storedToken =
      typeof window !== "undefined"
        ? localStorage.getItem("erp_auth_token")
        : null;
    const storedUserJson =
      typeof window !== "undefined"
        ? localStorage.getItem("erp_auth_user")
        : null;

    if (!storedToken || !storedUserJson) {
      setUser(null);
      setToken(null);
      setExpiresAt(null);
      setRemainingSeconds(0);
      syncCookies(null, null);
      setIsLoading(false);
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUserJson);
      const expMs = parseJwtExp(storedToken);
      const now = Date.now();

      if (expMs && expMs <= now) {
        // Token is already expired
        try {
          localStorage.setItem(
            "erp_locked_identity",
            JSON.stringify({
              accountName: parsedUser.accountName,
              username: parsedUser.username,
              fullName: parsedUser.fullName,
              role: parsedUser.role,
            })
          );
        } catch {}
        logout(true);
        setIsLoading(false);
        return;
      }

      setUser(parsedUser);
      setToken(storedToken);
      setExpiresAt(expMs);
      if (expMs) {
        setRemainingSeconds(Math.max(0, Math.floor((expMs - now) / 1000)));
      }
      syncCookies(parsedUser, storedToken);

      // Verify token with backend in background
      fetchMe()
        .then((result) => {
          if (!isMounted) return;
          if (result?.user) {
            setUser(result.user);
            syncCookies(result.user, storedToken);
          } else if (result?.isUnauthorized) {
            // Explicit 401/403: token was revoked/invalid on backend
            logout(false);
          }
          // Network/CORS blips: preserve existing valid local JWT session
        })
        .catch(() => {
          // Never log out on unexpected network/client exceptions
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return;
    } catch {
      // Corrupted session
      logout(false);
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [logout, pathname, router]);

  // Live Session Countdown Timer (1s interval)
  useEffect(() => {
    if (!expiresAt || !user) return;

    const interval = setInterval(() => {
      const diff = Math.floor((expiresAt - Date.now()) / 1000);
      if (diff <= 0) {
        clearInterval(interval);
        setRemainingSeconds(0);
        logout(true);
      } else {
        setRemainingSeconds(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, user, logout]);

  const refreshSession = useCallback(async () => {
    try {
      const res = await refreshSessionToken();
      if (res.accessToken && res.user) {
        setUser(res.user);
        setToken(res.accessToken);
        const expMs = parseJwtExp(res.accessToken) || Date.now() + 1800 * 1000;
        setExpiresAt(expMs);
        setRemainingSeconds(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
        syncCookies(res.user, res.accessToken);
      }
    } catch (err) {
      console.error("Failed to refresh session:", err);
    }
  }, []);

  const login = useCallback(
    async (payload: {
      accountName?: string;
      username?: string;
      email?: string;
      password: string;
      securityPin?: string;
      trustIp?: boolean;
      ipLabel?: string;
    }): Promise<AuthResponse> => {
      const res = await loginUser(payload);
      if (res.accessToken && res.user) {
        setUser(res.user);
        setToken(res.accessToken);
        const expMs = parseJwtExp(res.accessToken) || Date.now() + 1800 * 1000;
        setExpiresAt(expMs);
        setRemainingSeconds(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
        localStorage.removeItem("erp_locked_identity");
        syncCookies(res.user, res.accessToken);
        window.location.replace("/");
      }
      return res;
    },
    []
  );

  const demoLogin = useCallback(async () => {
    const res = await loginDemoUser();
    if (res.accessToken && res.user) {
      setUser(res.user);
      setToken(res.accessToken);
      const expMs = parseJwtExp(res.accessToken) || Date.now() + 1800 * 1000;
      setExpiresAt(expMs);
      setRemainingSeconds(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
      localStorage.removeItem("erp_locked_identity");
      syncCookies(res.user, res.accessToken);
      window.location.replace("/");
    }
  }, []);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      fullName: string;
      lifeStagePreset?: LifeStagePreset;
      uiDensityMode?: UiDensityMode;
      initialSalary?: number;
      dailyLivingBudget?: number;
      coreSavingsTarget?: number;
    }) => {
      const res = await registerMember(payload);
      if (res.accessToken && res.user) {
        setUser(res.user);
        setToken(res.accessToken);
        const expMs = parseJwtExp(res.accessToken) || Date.now() + 1800 * 1000;
        setExpiresAt(expMs);
        setRemainingSeconds(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
        syncCookies(res.user, res.accessToken);
        window.location.href = "/";
      }
    },
    []
  );

  const resetDemo = useCallback(async () => {
    await resetDemoSandbox();
    router.refresh();
  }, [router]);

  const switchAccount = useCallback(() => {
    router.push("/login");
  }, [router]);

  const isSessionExpiring = remainingSeconds <= 300 && remainingSeconds > 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        remainingSeconds,
        isSessionExpiring,
        refreshSession,
        login,
        demoLogin,
        register,
        resetDemo,
        logout,
        switchAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}


