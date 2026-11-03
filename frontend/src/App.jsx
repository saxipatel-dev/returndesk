import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { Loader2 } from "lucide-react";
import { homePathFor, useAuth } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";

// Pages are split into separate chunks and loaded on demand.
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const CustomerDashboard = lazy(() => import("./pages/customer/Dashboard"));
const Purchases = lazy(() => import("./pages/customer/Purchases"));
const NewRequest = lazy(() => import("./pages/customer/NewRequest"));
const MyRequests = lazy(() => import("./pages/customer/MyRequests"));
const CustomerRequestDetail = lazy(() => import("./pages/customer/RequestDetail"));
const StaffDashboard = lazy(() => import("./pages/staff/StaffDashboard"));
const Queue = lazy(() => import("./pages/staff/Queue"));
const StaffRequestDetail = lazy(() => import("./pages/staff/StaffRequestDetail"));
const Analytics = lazy(() => import("./pages/admin/Analytics"));
const Products = lazy(() => import("./pages/admin/Products"));
const UsersPage = lazy(() => import("./pages/admin/Users"));
const StoreSettings = lazy(() => import("./pages/admin/StoreSettings"));
const Profile = lazy(() => import("./pages/shared/Profile"));
const Notifications = lazy(() => import("./pages/shared/Notifications"));
const NotFound = lazy(() => import("./pages/shared/NotFound"));

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
    </div>
  );
}

/** Only render children for signed-in users, optionally limited to some roles. */
function RequireAuth({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />;
  return <Outlet />;
}

function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return user ? <Navigate to={homePathFor(user)} replace /> : <Outlet />;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return <Navigate to={homePathFor(user)} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<Notifications />} />

            <Route element={<RequireAuth roles={["customer"]} />}>
              <Route path="/dashboard" element={<CustomerDashboard />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/returns" element={<MyRequests />} />
              <Route path="/returns/new" element={<NewRequest />} />
              <Route path="/returns/:id" element={<CustomerRequestDetail />} />
            </Route>

            <Route element={<RequireAuth roles={["employee", "admin"]} />}>
              <Route path="/staff" element={<StaffDashboard />} />
              <Route path="/staff/queue" element={<Queue />} />
              <Route path="/staff/returns/:id" element={<StaffRequestDetail />} />
            </Route>

            <Route element={<RequireAuth roles={["admin"]} />}>
              <Route path="/admin/analytics" element={<Analytics />} />
              <Route path="/admin/products" element={<Products />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/settings" element={<StoreSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
