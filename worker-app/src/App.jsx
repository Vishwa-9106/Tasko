import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/Landing";
import ApplyPage from "./pages/Apply";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import MyEarningsPage from "./pages/MyEarnings";
import ProfilePage from "./pages/Profile";

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/my-earnings" element={<MyEarningsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
