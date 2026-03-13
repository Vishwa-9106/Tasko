import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicOnlyRoute from "./components/PublicOnlyRoute";
import LandingPage from "./pages/Landing";
import AuthPage from "./pages/Auth";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import HomePage from "./pages/Home";
import PackagesPage from "./pages/Packages";
import PackageSubscribePage from "./pages/PackageSubscribe";
import PackageSubscribeSuccessPage from "./pages/PackageSubscribeSuccess";
import BookingPage from "./pages/Booking";
import ProfilePage from "./pages/Profile";
import ServiceDetailsPage from "./pages/ServiceDetails";
import ServiceSubcategoriesPage from "./pages/ServiceSubcategories";
import TaskoMartPage from "./pages/TaskoMart";
import CartPage from "./pages/Cart";

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicOnlyRoute>
            <LandingPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/auth"
        element={
          <PublicOnlyRoute>
            <AuthPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
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
        path="/packages"
        element={
          <ProtectedRoute>
            <PackagesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscribe/:packageId"
        element={
          <ProtectedRoute>
            <PackageSubscribePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/subscribe/success/:subscriptionId"
        element={
          <ProtectedRoute>
            <PackageSubscribeSuccessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/services/:category/:serviceSlug"
        element={
          <ProtectedRoute>
            <ServiceDetailsPage />
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
