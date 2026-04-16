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
import { LogOut, User, Minus, X } from "lucide-react";
import { isElectron, minimizeToTray, quitApp } from "@/lib/electron";

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
    <header className="flex items-center justify-between h-14 px-6 border-b bg-card/80 backdrop-blur-sm">
      {/* Left: drag region for Electron */}
      <div className="flex-1 drag-region h-full" />

      {/* Right: user menu + window controls */}
      <div className="flex items-center gap-2 no-drag">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="flex items-center gap-2.5 h-9 px-2 rounded-lg hover:bg-muted transition-colors"
              />
            }
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium leading-none">
                {user?.full_name}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                {roleLabel}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  Code: {user?.operator_code}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
              <User className="mr-2 h-3.5 w-3.5" />
              {roleLabel}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Deconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Electron window controls */}
        {isElectron && (
          <div className="flex items-center gap-0.5 ml-2 pl-2 border-l">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm hover:bg-muted"
              onClick={minimizeToTray}
              aria-label="Minimiser"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm hover:bg-destructive/10 hover:text-destructive"
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
