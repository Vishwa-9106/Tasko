import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/Landing";
import AuthPage from "./pages/Auth";
import HomePage from "./pages/Home";
import AssignsPage from "./pages/Assigns";
import PackagesPage from "./pages/Packages";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assigns"
          element={
            <ProtectedRoute>
              <AssignsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/packages"
          element={
            <ProtectedRoute>
              <PackagesPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}