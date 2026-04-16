import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ChevronsLeft,
  ChevronsRight,
  Shield,
} from "lucide-react";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/lib/constants";
import { ROUTES } from "@/router/routes";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  roles: ("MANAGER" | "EMPLOYEE")[];
}

const navItems: NavItem[] = [
  {
    label: "Tableau de bord",
    icon: LayoutDashboard,
    path: ROUTES.DASHBOARD,
    roles: ["MANAGER"],
  },
  {
    label: "Operations",
    icon: FileSpreadsheet,
    path: ROUTES.OPERATIONS,
    roles: ["MANAGER"],
  },
  {
    label: "Employes",
    icon: Users,
    path: ROUTES.EMPLOYEES,
    roles: ["MANAGER"],
  },
  {
    label: "Imports Excel",
    icon: Upload,
    path: ROUTES.UPLOADS,
    roles: ["MANAGER"],
  },
  {
    label: "Mes operations",
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
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const filteredItems = navItems.filter(
    (item) => user && item.roles.includes(user.role),
  );

  const isActive = (path: string) => {
    if (path === ROUTES.DASHBOARD || path === ROUTES.MY_OPERATIONS) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full border-r transition-all duration-300 ease-in-out",
        "bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]",
      )}
      style={{
        width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        minWidth: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
      }}
    >
      {/* Logo area */}
      <div
        className={cn(
          "flex items-center h-14 px-4 border-b border-[hsl(var(--sidebar-border))]",
          sidebarCollapsed ? "justify-center" : "gap-3",
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-primary))]">
          <Shield className="h-4 w-4 text-[hsl(var(--sidebar-primary-foreground))]" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col min-w-0 animate-fade-in">
            <span className="text-sm font-semibold tracking-tight truncate">
              AssurTrack
            </span>
            <span className="text-[10px] text-[hsl(var(--sidebar-foreground))] opacity-50 truncate">
              Gestion courtage
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className="flex flex-col gap-1 px-2">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            if (sidebarCollapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-10 w-10 mx-auto",
                          "transition-all duration-200",
                          active
                            ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]"
                            : "text-[hsl(var(--sidebar-foreground))] opacity-60 hover:opacity-100 hover:bg-[hsl(var(--sidebar-accent))]",
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
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "justify-start h-10 px-3 gap-3 text-sm font-medium",
                  "transition-all duration-200",
                  active
                    ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]"
                    : "text-[hsl(var(--sidebar-foreground))] opacity-60 hover:opacity-100 hover:bg-[hsl(var(--sidebar-accent))]",
                )}
                onClick={() => navigate(item.path)}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
                {active && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[hsl(var(--sidebar-primary))]" />
                )}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Collapse toggle */}
      <Separator className="bg-[hsl(var(--sidebar-border))]" />
      <div className="p-2">
        <Button
          variant="ghost"
          size={sidebarCollapsed ? "icon" : "sm"}
          className={cn(
            "w-full text-[hsl(var(--sidebar-foreground))] opacity-50 hover:opacity-100 hover:bg-[hsl(var(--sidebar-accent))]",
            "transition-all duration-200",
            sidebarCollapsed && "h-10 w-10 mx-auto",
          )}
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Etendre la barre laterale" : "Reduire la barre laterale"}
        >
          {sidebarCollapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4 mr-2" />
              <span className="text-xs">Reduire</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
