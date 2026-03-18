import { createContext } from "react";
import type { components } from "@/api/schema";

type UserResponse = components["schemas"]["UserResponse"];

export interface AuthContextValue {
  user: UserResponse | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
