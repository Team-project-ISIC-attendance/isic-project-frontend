import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/features/auth/useAuth";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
}
