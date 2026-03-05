import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const linkBase = "rounded-md px-3 py-2 text-sm font-medium";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMarketingRoute = location.pathname === "/" || location.pathname === "/auth";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (isMarketingRoute) {
    return <div className="min-h-screen bg-[#ececec] text-[#1c1c1c]">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex w-full items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-brand-700">Tasko</h1>
          <nav className="flex items-center gap-2">
            <NavLink to="/home" className={linkBase}>
              Home
            </NavLink>
            <NavLink to="/assigns" className={linkBase}>
              Assigns
            </NavLink>
            <NavLink to="/packages" className={linkBase}>
              Packages
            </NavLink>
            {user ? (
              <button type="button" onClick={handleLogout} className="btn btn-secondary">
                Logout
              </button>
            ) : (
              <NavLink to="/auth" className="btn btn-primary">
                Login
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="w-full px-4 py-6">{children}</main>
    </div>
  );
}
