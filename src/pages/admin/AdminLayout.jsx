import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Home,
  Headphones,
  LogOut,
  Shield,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/households", label: "Households", icon: Home },
  { path: "/admin/support", label: "Support", icon: Headphones },
];

export default function AdminLayout() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Not admin");
        return r.json();
      })
      .then(setAdmin)
      .catch(() => navigate("/admin", { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    navigate("/admin", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100 truncate">Admin Console</div>
            <div className="text-xs text-slate-500 truncate">{admin.email}</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => { navigate(path); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? "bg-blue-600/15 text-blue-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"}`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors mb-1"
          >
            <Home className="w-4 h-4" />
            Back to App
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 lg:ml-60">
        <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-sm border-b border-slate-800 px-4 py-3 lg:px-6 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-slate-200">
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-medium text-slate-300">
            {NAV_ITEMS.find((n) => n.path === location.pathname)?.label || "Admin"}
          </h2>
        </header>

        <main className="p-4 lg:p-6">
          <Outlet context={{ admin }} />
        </main>
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
