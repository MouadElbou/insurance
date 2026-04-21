import { Routes, Route } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { RoleRoute } from "@/components/layout/RoleRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { OperationsPage } from "@/pages/OperationsPage";
import { EmployeesPage } from "@/pages/EmployeesPage";
import { EmployeeDetailPage } from "@/pages/EmployeeDetailPage";
import { UploadsPage } from "@/pages/UploadsPage";
import { MyOperationsPage } from "@/pages/MyOperationsPage";
import { ManualEntryPage } from "@/pages/ManualEntryPage";
import { PortalPage } from "@/pages/PortalPage";
import { ScraperEventsPage } from "@/pages/ScraperEventsPage";
import { InsurerDomainsPage } from "@/pages/InsurerDomainsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useAuthStore } from "@/stores/auth.store";
import { ROUTES } from "@/router/routes";

function RootRedirect() {
  const user = useAuthStore((s) => s.user);
  if (user?.role === "EMPLOYEE") {
    return <Navigate to={ROUTES.MY_OPERATIONS} replace />;
  }
  return <Navigate to={ROUTES.DASHBOARD} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<RootRedirect />} />
          <Route element={<RoleRoute allowed={["MANAGER"]} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/uploads" element={<UploadsPage />} />
            <Route path={ROUTES.SCRAPER_EVENTS} element={<ScraperEventsPage />} />
            <Route path={ROUTES.INSURER_DOMAINS} element={<InsurerDomainsPage />} />
          </Route>
          <Route element={<RoleRoute allowed={["EMPLOYEE"]} />}>
            <Route path="/my-operations" element={<MyOperationsPage />} />
            <Route path="/entry" element={<ManualEntryPage />} />
          </Route>
          <Route element={<RoleRoute allowed={["MANAGER", "EMPLOYEE"]} />}>
            <Route path={ROUTES.PORTAL} element={<PortalPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
