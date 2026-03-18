import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { components } from "@/api/schema";
import * as api from "@/api/client";
import { AuthContext } from "./AuthContext";

type UserResponse = components["schemas"]["UserResponse"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function validateToken() {
      const token = api.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await api.getMe();
        setUser(me);
      } catch {
        api.clearToken();
      } finally {
        setIsLoading(false);
      }
    }

    validateToken();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokenResponse = await api.login(email, password);
      api.setToken(tokenResponse.access_token);
      const me = await api.getMe();
      setUser(me);
      navigate("/");
    },
    [navigate],
  );

  const logout = useCallback(() => {
    api.clearToken();
    setUser(null);
    navigate("/login");
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
