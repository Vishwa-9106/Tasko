import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/Landing";
import ApplyPage from "./pages/Apply";
import LoginPage from "./pages/Login";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import HomePage from "./pages/Home";
import JobsPage from "./pages/Jobs";
import JobDetailsPage from "./pages/JobDetails";
import ProgressPage from "./pages/Progress";
import ProfilePage from "./pages/Profile";

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/apply" element={<ApplyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailsPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
