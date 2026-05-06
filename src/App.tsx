import { Route, Routes } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { CalendarPage } from "./pages/CalendarPage";
import { DevicesPage } from "./pages/DevicesPage";
import { AdminPage } from "./pages/AdminPage";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { useAuth } from "./features/auth/useAuth";

function DashboardRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <LoginPage />;
  }

  return user.role === "admin" ? <AdminPage /> : <CalendarPage />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardRoute />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}

export default App;
