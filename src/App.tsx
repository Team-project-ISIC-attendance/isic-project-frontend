import { Route, Routes } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<CalendarPage />} />
      </Route>
    </Routes>
  );
}

export default App;
