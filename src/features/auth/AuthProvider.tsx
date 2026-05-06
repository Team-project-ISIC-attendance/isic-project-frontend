import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import * as api from "@/api/client";
import type { AuthUserResponse } from "@/api/client";
import { AuthContext } from "./AuthContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const refreshUser = useCallback(async () => {
    const me = await api.getMe();
    setUser(me);
  }, []);

  useEffect(() => {
    async function validateToken() {
      const token = api.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        await refreshUser();
      } catch {
        api.clearToken();
      } finally {
        setIsLoading(false);
      }
    }

    validateToken();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokenResponse = await api.login(email, password);
      api.setToken(tokenResponse.access_token);
      const userData = await api.getMe();
      setUser(userData);
      navigate(userData.role === "admin" ? "/admin" : "/");
    },
    [navigate],
  );

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
    navigate("/login");
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
