import type { Employee, OperationStats } from "@insurance/shared";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactCurrency } from "@/lib/format";

const AVATAR_COLORS = [
  "bg-primary-fixed text-primary",
  "bg-tertiary-fixed text-tertiary",
  "bg-secondary-fixed text-secondary",
] as const;

interface EmployeeCardProps {
  employee: Employee;
  index: number;
  stats?: OperationStats;
  onView: (employee: Employee) => void;
}

export function EmployeeCard({
  employee,
  index,
  stats,
  onView,
}: EmployeeCardProps) {
  const initials = employee.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const colorClass = AVATAR_COLORS[index % 3];
  const isManager = employee.role === "MANAGER";

  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-900/5 group border border-transparent hover:border-primary/10">
      {/* Header: avatar + name + role badge */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl shadow-inner",
              colorClass,
            )}
          >
            {initials}
          </div>
          <div>
            <h3 className="font-bold text-lg text-on-surface">
              {employee.full_name}
            </h3>
            <p className="text-sm text-on-surface-variant">{employee.email}</p>
          </div>
        </div>
        <span
          className={cn(
            "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full shrink-0",
            isManager
              ? "bg-secondary-container/30 text-on-secondary-container"
              : "bg-surface-container-highest text-primary",
          )}
        >
          {isManager ? "Manager" : "Collaborateur"}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-3 bg-surface-container-low rounded-lg">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter mb-1">
            Polices Actives
          </p>
          <p className="text-xl font-bold tabular-nums">
            {stats?.total_policies ?? 0}
          </p>
        </div>
        <div className="p-3 bg-surface-container-low rounded-lg">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter mb-1">
            C.A. Généré
          </p>
          <p className="text-xl font-bold tabular-nums">
            {formatCompactCurrency(stats?.total_prime_net)}{" "}
            <span className="text-xs font-medium opacity-60">MAD</span>
          </p>
        </div>
      </div>

      {/* Footer: stacked circles + Voir Profil */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/10">
        <div className="flex -space-x-2">
          <div className="w-7 h-7 rounded-full border-2 border-white bg-surface-container-highest" />
          {(stats?.total_operations ?? 0) > 10 && (
            <div className="w-7 h-7 rounded-full border-2 border-white bg-blue-200" />
          )}
          {(stats?.total_operations ?? 0) > 30 && (
            <div className="w-7 h-7 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
              +{Math.min(99, Math.floor((stats?.total_operations ?? 0) / 10))}
            </div>
          )}
        </div>
        <button
          onClick={() => onView(employee)}
          className="text-primary font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all"
        >
          Voir Profil
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
