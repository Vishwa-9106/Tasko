import { Link, Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/Landing";
import RegisterPage from "./pages/Register";
import TestPage from "./pages/Test";
import WaitingApprovalPage from "./pages/WaitingApproval";
import DashboardPage from "./pages/Dashboard";

function TopNav() {
  return (
    <header className="border-b border-orange-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold text-accent-700">Tasko Worker</h1>
        <nav className="flex gap-3 text-sm font-medium text-slate-700">
          <Link to="/">Landing</Link>
          <Link to="/register">Register</Link>
          <Link to="/test">Test</Link>
          <Link to="/waiting">Waiting</Link>
          <Link to="/dashboard">Dashboard</Link>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="/waiting" element={<WaitingApprovalPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}