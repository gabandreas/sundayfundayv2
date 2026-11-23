"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import {
  AuthenticatedUser,
  AuthResponse,
  LifeStagePreset,
  UiDensityMode,
  loginUser,
  loginDemoUser,
  logoutUserApi,
  registerMember,
  fetchMe,
  resetDemoSandbox,
  refreshSessionToken,
  updateProfile,
  invalidateCache,
} from "@/lib/api";

interface AuthContextType {
  user: AuthenticatedUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSigningOut: boolean;
  remainingSeconds: number;
  isSessionExpiring: boolean;
  isProfileModalOpen: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  updateUserProfile: (payload: {
    fullName?: string;
    email?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  applySessionBundle: (res: AuthResponse) => void;
  refreshSession: () => Promise<boolean>;
  login: (payload: {
    accountName?: string;
    username?: string;
    email?: string;
    password: string;
    securityPin?: string;
    trustIp?: boolean;
    ipLabel?: string;
    nextPath?: string | null;
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
  logout: (isExpired?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = new Set(["/login", "/forgot-password", "/reset-password"]);

function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function parseJwtExp(token: string): number | null {
  const parsed = parseJwtPayload(token);
  return parsed?.exp ? parsed.exp * 1000 : null;
}

function readClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return trimmed.slice(prefix.length);
      }
    }
  }
  return null;
}

function getSafeNextRedirect(rawNext?: string | null): string {
  if (!rawNext || !rawNext.startsWith("/") || rawNext.startsWith("//")) return "/";
  if (PUBLIC_ROUTES.has(rawNext) || rawNext.startsWith("/change-password")) return "/";
  return rawNext;
}

function readStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      localStorage.getItem("erp_refresh_token") ||
      sessionStorage.getItem("erp_refresh_token")
    );
  } catch {
    return null;
  }
}

function syncClientStorage(
  user: AuthenticatedUser | null,
  token: string | null,
  refreshToken?: string | null,
) {
  if (typeof window === "undefined") return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("erp_locked_")) {
        localStorage.removeItem(k);
      }
    }
  } catch {}
  if (user && token) {
    const serialized = JSON.stringify(user);
    try {
      localStorage.setItem("erp_auth_token", token);
      localStorage.setItem("erp_auth_user", serialized);
      if (refreshToken) {
        localStorage.setItem("erp_refresh_token", refreshToken);
      }
    } catch {}
    try {
      sessionStorage.setItem("erp_auth_token", token);
      sessionStorage.setItem("erp_auth_user", serialized);
      if (refreshToken) {
        sessionStorage.setItem("erp_refresh_token", refreshToken);
      }
    } catch {}
    const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `erp_user_id=${user.id}; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
    document.cookie = `erp_auth_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
  } else {
    try {
      localStorage.removeItem("erp_auth_token");
      localStorage.removeItem("erp_auth_user");
      localStorage.removeItem("erp_refresh_token");
    } catch {}
    try {
      sessionStorage.removeItem("erp_auth_token");
      sessionStorage.removeItem("erp_auth_user");
      sessionStorage.removeItem("erp_refresh_token");
    } catch {}
    document.cookie = "erp_user_id=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "erp_auth_token=; path=/; max-age=0; SameSite=Lax";
  }
}

function clearSessionPrivacyStorage() {
  if (typeof window === "undefined") return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith("erp_privacy_session_")) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const refreshPromiseRef = useRef<Promise<boolean> | null>(null);
  const loggingOutRef = useRef<boolean>(false);

  const clearClientSessionState = useCallback(
    (reason: "expired" | "signed_out" | "silent") => {
      setUser(null);
      setToken(null);
      setExpiresAt(null);
      setRemainingSeconds(0);
      setIsProfileModalOpen(false);
      syncClientStorage(null, null, null);
      clearSessionPrivacyStorage();
      invalidateCache();

      if (reason === "expired") {
        router.replace("/login?expired=1");
      } else if (reason === "signed_out") {
        router.replace("/login?signedOut=1");
      } else if (!PUBLIC_ROUTES.has(pathname)) {
        router.replace("/login");
      }
    },
    [pathname, router],
  );

  const logout = useCallback(
    async (isExpired = false) => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      setIsSigningOut(true);

      const storedRefresh = readStoredRefreshToken();
      await logoutUserApi(storedRefresh);

      clearClientSessionState(isExpired ? "expired" : "signed_out");
      toast({
        title: isExpired ? "Session expired" : "Signed out",
        description: isExpired
          ? "Please sign in again to continue."
          : "Your session was closed cleanly.",
        variant: isExpired ? "warning" : "info",
      });
      setTimeout(() => {
        loggingOutRef.current = false;
        setIsSigningOut(false);
      }, 150);
    },
    [clearClientSessionState, toast],
  );

  const applySessionBundle = useCallback((res: AuthResponse) => {
    if (!res.accessToken || !res.user) return;
    invalidateCache();
    setUser(res.user);
    setToken(res.accessToken);
    const expMs = parseJwtExp(res.accessToken) || Date.now() + 1800 * 1000;
    setExpiresAt(expMs);
    setRemainingSeconds(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
    syncClientStorage(res.user, res.accessToken, res.refreshToken ?? readStoredRefreshToken());
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }
    const runner = (async () => {
      try {
        const storedRefresh = readStoredRefreshToken();
        const res = await refreshSessionToken(storedRefresh);
        if (res.accessToken && res.user) {
          setUser(res.user);
          setToken(res.accessToken);
          const expMs = parseJwtExp(res.accessToken) || Date.now() + 1800 * 1000;
          setExpiresAt(expMs);
          setRemainingSeconds(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
          syncClientStorage(res.user, res.accessToken, res.refreshToken ?? storedRefresh);
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = runner;
    return runner;
  }, []);

  // Initialize session on mount (localStorage -> sessionStorage -> cookie) + silent refresh recovery
  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      let storedToken: string | null = null;
      let storedUserJson: string | null = null;
      const storedRefresh = readStoredRefreshToken();

      if (typeof window !== "undefined") {
        try {
          storedToken = localStorage.getItem("erp_auth_token");
          storedUserJson = localStorage.getItem("erp_auth_user");
        } catch {}
        if (!storedToken) {
          try {
            storedToken = sessionStorage.getItem("erp_auth_token");
            storedUserJson = storedUserJson || sessionStorage.getItem("erp_auth_user");
          } catch {}
        }
        if (!storedToken) {
          storedToken = readClientCookie("erp_auth_token");
        }
      }

      if (!storedToken && storedRefresh) {
        const refreshed = await refreshSession();
        if (isMounted) setIsLoading(false);
        if (refreshed) return;
      }

      if (!storedToken) {
        if (!isMounted) return;
        setUser(null);
        setToken(null);
        setExpiresAt(null);
        setRemainingSeconds(0);
        syncClientStorage(null, null, null);
        setIsLoading(false);
        if (!PUBLIC_ROUTES.has(pathname)) {
          router.replace("/login");
        }
        return;
      }

      try {
        let parsedUser: AuthenticatedUser | null = null;
        if (storedUserJson) {
          parsedUser = JSON.parse(storedUserJson);
        } else {
          const claims = parseJwtPayload(storedToken);
          if (claims?.sub) {
            parsedUser = {
              id: Number(claims.sub),
              accountName: claims.accountName || claims.username || "",
              username: claims.username || claims.accountName || "",
              email: claims.email || "",
              role: (claims.role as AuthenticatedUser["role"]) || "STANDARD_MEMBER",
              blueprintType:
                (claims.blueprintType as AuthenticatedUser["blueprintType"]) || "STANDARD_GENERAL",
              fullName: claims.fullName || claims.username || "Member",
              status: (claims.status as AuthenticatedUser["status"]) || "ACTIVE",
              mustChangePassword: Boolean(claims.mcp),
            };
          }
        }
        if (!parsedUser) {
          throw new Error("Missing user session payload");
        }

        const expMs = parseJwtExp(storedToken);
        const now = Date.now();
        if (expMs && expMs <= now) {
          if (storedRefresh) {
            const recovered = await refreshSession();
            if (isMounted && recovered) {
              setIsLoading(false);
              return;
            }
          }
          if (isMounted) {
            clearClientSessionState("expired");
            setIsLoading(false);
          }
          return;
        }

        if (!isMounted) return;
        setUser(parsedUser);
        setToken(storedToken);
        setExpiresAt(expMs);
        if (expMs) {
          setRemainingSeconds(Math.max(0, Math.floor((expMs - now) / 1000)));
        }
        syncClientStorage(parsedUser, storedToken, storedRefresh);

        fetchMe()
          .then((result) => {
            if (!isMounted) return;
            if (result?.user) {
              setUser(result.user);
              syncClientStorage(result.user, storedToken!, storedRefresh);
            } else if (result?.isUnauthorized) {
              clearClientSessionState("expired");
            }
          })
          .catch(() => {})
          .finally(() => {
            if (isMounted) setIsLoading(false);
          });
      } catch {
        if (isMounted) {
          clearClientSessionState("silent");
          setIsLoading(false);
        }
      }
    };

    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, [clearClientSessionState, pathname, refreshSession, router]);

  // Enforce forced first-login password change gate
  useEffect(() => {
    if (isLoading || !user) return;
    if (user.mustChangePassword && pathname !== "/change-password") {
      router.replace("/change-password");
    } else if (!user.mustChangePassword && pathname === "/change-password") {
      router.replace("/");
    }
  }, [isLoading, pathname, router, user]);

  // Countdown + automatic silent refresh before expiry
  useEffect(() => {
    if (!expiresAt || !user) return;
    let triggeredSilentRefresh = false;

    const interval = setInterval(() => {
      const diff = Math.floor((expiresAt - Date.now()) / 1000);
      if (diff <= 120 && diff > 0 && !triggeredSilentRefresh && readStoredRefreshToken()) {
        triggeredSilentRefresh = true;
        void refreshSession();
      }
      if (diff <= 0) {
        clearInterval(interval);
        setRemainingSeconds(0);
        void logout(true);
      } else {
        setRemainingSeconds(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, user, logout, refreshSession]);

  const login = useCallback(
    async (payload: {
      accountName?: string;
      username?: string;
      email?: string;
      password: string;
      securityPin?: string;
      trustIp?: boolean;
      ipLabel?: string;
      nextPath?: string | null;
    }): Promise<AuthResponse> => {
      const { nextPath, ...credentials } = payload;
      const res = await loginUser(credentials);
      if (res.accessToken && res.user) {
        clearSessionPrivacyStorage();
        applySessionBundle(res);
        const mustChange = Boolean(res.mustChangePassword || res.user.mustChangePassword);
        router.replace(mustChange ? "/change-password" : getSafeNextRedirect(nextPath));
        router.refresh();
      }
      return res;
    },
    [applySessionBundle, router],
  );

  const demoLogin = useCallback(async () => {
    const res = await loginDemoUser();
    if (res.accessToken && res.user) {
      clearSessionPrivacyStorage();
      applySessionBundle(res);
      router.replace("/");
      router.refresh();
    }
  }, [applySessionBundle, router]);

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
        applySessionBundle(res);
        router.replace("/");
        router.refresh();
      }
    },
    [applySessionBundle, router],
  );

  const resetDemo = useCallback(async () => {
    await resetDemoSandbox();
    invalidateCache();
    router.refresh();
  }, [router]);

  const openProfileModal = useCallback(() => {
    setIsProfileModalOpen(true);
  }, []);

  const closeProfileModal = useCallback(() => {
    setIsProfileModalOpen(false);
  }, []);

  const updateUserProfile = useCallback(
    async (payload: { fullName?: string; email?: string }) => {
      const res = await updateProfile(payload);
      if (!res.success || !res.data?.user) {
        return { success: false, error: res.error || "Failed to update profile." };
      }
      const nextToken = res.data.accessToken || token;
      invalidateCache();
      setUser(res.data.user);
      if (nextToken) {
        setToken(nextToken);
        const expMs = parseJwtExp(nextToken) || Date.now() + 1800 * 1000;
        setExpiresAt(expMs);
        setRemainingSeconds(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
        syncClientStorage(res.data.user, nextToken, readStoredRefreshToken());
      }
      return { success: true };
    },
    [token],
  );

  const isSessionExpiring = remainingSeconds <= 300 && remainingSeconds > 0;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        isSigningOut,
        remainingSeconds,
        isSessionExpiring,
        isProfileModalOpen,
        openProfileModal,
        closeProfileModal,
        updateUserProfile,
        applySessionBundle,
        refreshSession,
        login,
        demoLogin,
        register,
        resetDemo,
        logout,
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
