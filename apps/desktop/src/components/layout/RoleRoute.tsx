import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { ROUTES } from "@/router/routes";
import type { Role } from "@insurance/shared";

interface RoleRouteProps {
  allowed: Role[];
}

export function RoleRoute({ allowed }: RoleRouteProps) {
  const user = useAuthStore((s) => s.user);

  if (!user || !allowed.includes(user.role)) {
    // Redirect to the role-appropriate landing page instead of "/" to avoid loops
    const redirectTo =
      user?.role === "EMPLOYEE" ? ROUTES.MY_OPERATIONS : ROUTES.DASHBOARD;
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
