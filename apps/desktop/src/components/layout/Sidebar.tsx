import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Upload,
  PenLine,
  Shield,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Globe,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/lib/constants";
import { ROUTES } from "@/router/routes";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  roles: ("MANAGER" | "EMPLOYEE")[];
}

interface NavGroup {
  /**
   * Optional short label shown above the group when the sidebar is expanded.
   * Groups without a label render as a thin divider instead — used for the
   * top-level "Home" stack where a heading would feel redundant.
   */
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      {
        label: "Tableau de bord",
        icon: LayoutDashboard,
        path: ROUTES.DASHBOARD,
        roles: ["MANAGER"],
      },
      {
        label: "Opérations",
        icon: FileSpreadsheet,
        path: ROUTES.OPERATIONS,
        roles: ["MANAGER"],
      },
      {
        label: "Collaborateurs",
        icon: Users,
        path: ROUTES.EMPLOYEES,
        roles: ["MANAGER"],
      },
      {
        label: "Imports",
        icon: Upload,
        path: ROUTES.UPLOADS,
        roles: ["MANAGER"],
      },
      {
        label: "Mes opérations",
        icon: FileSpreadsheet,
        path: ROUTES.MY_OPERATIONS,
        roles: ["EMPLOYEE"],
      },
      {
        label: "Saisie manuelle",
        icon: PenLine,
        path: ROUTES.MANUAL_ENTRY,
        roles: ["EMPLOYEE"],
      },
    ],
  },
  {
    label: "Capture",
    items: [
      {
        label: "Portail assureur",
        icon: Globe,
        path: ROUTES.PORTAL,
        roles: ["MANAGER", "EMPLOYEE"],
      },
      {
        label: "Événements scraper",
        icon: Activity,
        path: ROUTES.SCRAPER_EVENTS,
        roles: ["MANAGER"],
      },
      {
        label: "Domaines assureurs",
        icon: ShieldCheck,
        path: ROUTES.INSURER_DOMAINS,
        roles: ["MANAGER"],
      },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  // Filter each group's items by role, then drop any group that ends up empty
  // (e.g. employees don't see "Domaines assureurs"). This keeps the "Capture"
  // header from rendering over a single lonely item for employees.
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => user && item.roles.includes(user.role),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const isActive = (path: string) => {
    // Exact-match routes: these have deeper pages that shouldn't keep the
    // top-level entry highlighted (e.g. /employees/:id shouldn't light up
    // "Employees" once we're in a detail view — the breadcrumb handles that).
    if (path === ROUTES.DASHBOARD || path === ROUTES.MY_OPERATIONS) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    clearAuth();
    navigate(ROUTES.LOGIN);
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-blue-50 transition-all duration-300 ease-in-out tracking-tight",
      )}
      style={{
        width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        minWidth: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
      }}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center p-6",
          sidebarCollapsed ? "justify-center px-2" : "gap-3",
        )}
      >
        <div className="w-10 h-10 shrink-0 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xl">
          <Shield className="h-5 w-5" />
        </div>
        {!sidebarCollapsed && (
          <div className="animate-fade-in">
            <h1 className="text-xl font-bold tracking-tighter text-blue-900">
              Courtage Pro
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold">
              Gestion d'Assurance
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 mt-6 space-y-4",
          sidebarCollapsed ? "px-2" : "px-4",
        )}
        aria-label="Navigation principale"
      >
        {filteredGroups.map((group, groupIdx) => (
          <div key={group.label ?? `group-${groupIdx}`} className="space-y-1">
            {/* Group header: label when expanded, thin divider when collapsed
                — but only for groups *after* the first one so we don't draw a
                spacer above the top-level items. */}
            {group.label ? (
              sidebarCollapsed ? (
                groupIdx > 0 ? (
                  <div
                    className="mx-auto my-2 h-px w-6 bg-blue-200/70"
                    aria-hidden
                  />
                ) : null
              ) : (
                <div
                  className={cn(
                    "px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-blue-600/80",
                    groupIdx > 0 && "mt-1 border-t border-blue-200/50 pt-4",
                  )}
                >
                  {group.label}
                </div>
              )
            ) : null}

            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              if (sidebarCollapsed) {
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger
                      render={
                        <button
                          className={cn(
                            "flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-colors",
                            active
                              ? "text-blue-700 bg-blue-100/50"
                              : "text-slate-600 hover:text-blue-600 hover:bg-blue-100/30",
                          )}
                          onClick={() => navigate(item.path)}
                          aria-label={item.label}
                          aria-current={active ? "page" : undefined}
                        />
                      }
                    >
                      <Icon className="h-5 w-5" />
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <button
                  key={item.path}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors",
                    active
                      ? "text-blue-700 font-semibold border-l-2 border-blue-700 bg-blue-100/50"
                      : "text-slate-600 hover:text-blue-600 hover:bg-blue-100/30",
                  )}
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div
        className={cn(
          "border-t border-blue-100/15 space-y-1",
          sidebarCollapsed ? "p-2" : "p-4",
        )}
      >
        {sidebarCollapsed ? (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl text-slate-600 hover:text-blue-600 transition-colors"
                    aria-label="Paramètres"
                  />
                }
              >
                <Settings className="h-5 w-5" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Paramètres
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl text-slate-600 hover:text-red-600 transition-colors"
                    onClick={handleLogout}
                    aria-label="Déconnexion"
                  />
                }
              >
                <LogOut className="h-5 w-5" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Déconnexion
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl text-slate-600 hover:text-blue-600 transition-colors"
                    onClick={toggleSidebar}
                    aria-label="Étendre la barre latérale"
                  />
                }
              >
                <ChevronsRight className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Étendre
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <button className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-600 hover:text-blue-600 transition-colors">
              <Settings className="h-5 w-5 shrink-0" />
              <span className="font-medium">Paramètres</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-slate-600 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="font-medium">Déconnexion</span>
            </button>
            <button
              onClick={toggleSidebar}
              className="flex items-center gap-3 w-full px-4 py-2 rounded-xl text-slate-400 hover:text-blue-600 transition-colors text-xs"
            >
              <ChevronsLeft className="h-4 w-4 shrink-0" />
              <span className="font-medium">Réduire</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
