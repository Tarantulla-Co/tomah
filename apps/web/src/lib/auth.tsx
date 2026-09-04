import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiPost, setAccessToken, setAuthLostHandler } from "./api";
import type { AuthUser, UserRole } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface SessionResponse {
  user: AuthUser;
  accessToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  // On mount, try to restore a session from the refresh cookie.
  useEffect(() => {
    let cancelled = false;
    apiPost<SessionResponse>("/auth/refresh", undefined, { skipRefresh: true })
      .then((res) => {
        if (cancelled) return;
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If the API client exhausts a refresh, drop back to anonymous.
  useEffect(() => {
    setAuthLostHandler(() => {
      setUser(null);
      setStatus("anonymous");
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiPost<SessionResponse>("/auth/login", { email, password }, { skipRefresh: true });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost("/auth/logout", undefined, { skipRefresh: true });
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      if (user.role === "ADMIN") return true;
      return roles.includes(user.role);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, status, login, logout, hasRole }),
    [user, status, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
