import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Minus, X, Bell, HelpCircle, Plus } from "lucide-react";
import { isElectron, minimizeToTray, quitApp } from "@/lib/electron";
import { SearchInput } from "@/components/shared/SearchInput";

export function Header() {
  const { logout } = useAuth();
  const user = useAuthStore((s) => s.user);

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  const roleLabel = user?.role === "MANAGER" ? "Responsable" : "Employe";

  return (
    <header className="flex items-center justify-between h-14 px-6 glass ghost-border z-10">
      {/* Left: drag region for Electron */}
      <div className="flex-1 drag-region h-full" />

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-4 no-drag">
        <SearchInput
          placeholder="Rechercher..."
          className="h-9 rounded-full bg-surface-container-low border-0 text-sm"
        />
      </div>

      {/* Right: actions + user menu + window controls */}
      <div className="flex items-center gap-1.5 no-drag">
        {/* New policy CTA */}
        <Button
          size="sm"
          className="h-8 px-3 gradient-cta text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-shadow"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Nouvelle Police
        </Button>

        {/* Notification */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-on-surface-variant hover:bg-surface-container-low rounded-lg"
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* Help */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-on-surface-variant hover:bg-surface-container-low rounded-lg"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="flex items-center gap-2 h-9 px-2 rounded-lg hover:bg-surface-container-low transition-colors"
              />
            }
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary-container text-on-primary-container text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-on-surface leading-none">
                {user?.full_name}
              </span>
              <span className="text-[10px] text-on-surface-variant leading-none mt-0.5">
                {roleLabel}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 glass ghost-border rounded-xl">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-on-surface">{user?.full_name}</p>
                <p className="text-xs text-on-surface-variant">{user?.email}</p>
                <p className="text-xs text-on-surface-variant font-mono">
                  Code: {user?.operator_code}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-outline-variant/15" />
            <DropdownMenuItem className="text-xs text-on-surface-variant" disabled>
              <User className="mr-2 h-3.5 w-3.5" />
              {roleLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-outline-variant/15" />
            <DropdownMenuItem
              onClick={logout}
              className="text-error-m3 focus:text-error-m3"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Deconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Electron window controls */}
        {isElectron && (
          <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-outline-variant/15">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm text-on-surface-variant hover:bg-surface-container-low"
              onClick={minimizeToTray}
              aria-label="Minimiser"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm hover:bg-error-container hover:text-on-error-container"
              onClick={quitApp}
              aria-label="Quitter"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
