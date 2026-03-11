import { Navigate, Route, Routes, useLocation } from "react-router";
import { Login } from "./pages/login";
import { Dashboard } from "./pages/dashboard";

function App() {
  const location = useLocation();

  if (location.pathname === "/") {
    return <Navigate to="/login" />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;
