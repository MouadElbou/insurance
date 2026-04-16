import type { Employee } from "@insurance/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, UserX, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";

interface EmployeeCardProps {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employee: Employee) => void;
  onView: (employee: Employee) => void;
}

export function EmployeeCard({
  employee,
  onEdit,
  onDeactivate,
  onView,
}: EmployeeCardProps) {
  const initials = employee.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleLabel = employee.role === "MANAGER" ? "Responsable" : "Employe";

  return (
    <div
      className={cn(
        "group rounded-xl border bg-card p-4 transition-all duration-200",
        "hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5",
        !employee.is_active && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback
            className={cn(
              "text-sm font-semibold",
              employee.is_active
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold truncate">
              {employee.full_name}
            </h4>
            {!employee.is_active && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                Inactif
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {employee.email}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant="outline"
              className="text-[10px] font-mono h-5 px-1.5"
            >
              {employee.operator_code}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] h-5 px-1.5",
                employee.role === "MANAGER"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-blue-200 bg-blue-50 text-blue-700",
              )}
            >
              {roleLabel}
            </Badge>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onView(employee)}>
              <Eye className="h-3.5 w-3.5 mr-2" />
              Voir les details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(employee)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Modifier
            </DropdownMenuItem>
            {employee.is_active && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDeactivate(employee)}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="h-3.5 w-3.5 mr-2" />
                  Desactiver
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {employee.last_heartbeat && (
        <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t">
          Derniere activite: {formatRelativeTime(employee.last_heartbeat)}
        </p>
      )}
    </div>
  );
}
