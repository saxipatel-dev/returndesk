import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  Bell,
  ClipboardList,
  FilePlus2,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../utils/labels";
import { initials } from "../../utils/format";
import NotificationBell from "./NotificationBell";

const NAV = {
  customer: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/purchases", label: "My purchases", icon: ShoppingBag },
    { to: "/returns", label: "My requests", icon: ClipboardList, end: true },
    { to: "/returns/new", label: "New request", icon: FilePlus2 },
  ],
  employee: [
    { to: "/staff", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/staff/queue", label: "Work queue", icon: Inbox },
  ],
  admin: [
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/staff/queue", label: "Request monitor", icon: Inbox },
    { to: "/admin/products", label: "Products", icon: Package },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/settings", label: "Return policy", icon: Settings },
  ],
};

const ACCOUNT_NAV = [
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg font-semibold tracking-tight text-white">ReturnDesk</span>
    </div>
  );
}

function NavItem({ item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      {item.label}
    </NavLink>
  );
}

function Sidebar({ user, onLogout }) {
  return (
    <div className="flex h-full flex-col bg-slate-900 px-3 py-5">
      <Logo />
      <nav className="mt-8 flex-1 space-y-6" aria-label="Main">
        <div className="space-y-1">
          {NAV[user.role].map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </div>
        <div>
          <p className="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">Account</p>
          <div className="space-y-1">
            {ACCOUNT_NAV.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </div>
        </div>
      </nav>
      <div className="mt-6 flex items-center gap-3 rounded-lg border border-white/10 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white">
          {initials(user.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-slate-400">{ROLES[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Remember which page the mobile menu was opened on; navigating closes it.
  const [mobileOpenOn, setMobileOpenOn] = useState(null);
  const mobileOpen = mobileOpenOn === location.pathname;
  const setMobileOpen = (open) => setMobileOpenOn(open ? location.pathname : null);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:p-2"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 lg:block">
        <Sidebar user={user} onLogout={handleLogout} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="relative h-full w-64">
            <Sidebar user={user} onLogout={handleLogout} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 -right-11 rounded-md bg-white/10 p-1.5 text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="hidden text-sm text-slate-500 sm:block">{ROLES[user.role]} portal</p>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense
            fallback={
              <div className="flex justify-center py-24" role="status" aria-label="Loading page">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
