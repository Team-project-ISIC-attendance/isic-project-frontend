import { Route, Routes } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { CalendarPage } from "./pages/CalendarPage";
import { DevicesPage } from "./pages/DevicesPage";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<CalendarPage />} />
        <Route path="/devices" element={<DevicesPage />} />
      </Route>
    </Routes>
  );
}

export default App;
