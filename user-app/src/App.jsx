import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/Landing";
import AuthPage from "./pages/Auth";
import HomePage from "./pages/Home";
import AssignsPage from "./pages/Assigns";
import PackagesPage from "./pages/Packages";
import BookingPage from "./pages/Booking";
import ProfilePage from "./pages/Profile";
import ServiceSubcategoriesPage from "./pages/ServiceSubcategories";
import TaskoMartPage from "./pages/TaskoMart";
import CartPage from "./pages/Cart";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking"
        element={
          <ProtectedRoute>
            <BookingPage />
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
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <ServiceSubcategoriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/taskomart"
        element={
          <ProtectedRoute>
            <TaskoMartPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cart"
        element={
          <ProtectedRoute>
            <CartPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
