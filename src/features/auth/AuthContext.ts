import { createContext } from "react";
import type { AuthUserResponse } from "@/api/client";

export interface AuthContextValue {
  user: AuthUserResponse | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
