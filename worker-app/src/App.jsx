import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/Landing";
import RegisterPage from "./pages/Register";
import LoginPage from "./pages/Login";
import TestPage from "./pages/Test";
import WaitingApprovalPage from "./pages/WaitingApproval";
import DashboardPage from "./pages/Dashboard";
import MyEarningsPage from "./pages/MyEarnings";
import ProfilePage from "./pages/Profile";

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/waiting" element={<WaitingApprovalPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/my-earnings" element={<MyEarningsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
