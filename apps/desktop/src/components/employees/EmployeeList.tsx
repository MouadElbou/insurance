import type { Employee, OperationStats } from "@insurance/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { EmployeeCard } from "./EmployeeCard";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployeeListProps {
  employees: Employee[];
  isLoading: boolean;
  statsMap?: Record<string, OperationStats>;
  onView: (employee: Employee) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 space-y-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export function EmployeeList({
  employees,
  isLoading,
  statsMap,
  onView,
}: EmployeeListProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "grid gap-6",
          "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aucun collaborateur"
        description="Ajoutez votre premier collaborateur pour commencer."
      />
    );
  }

  return (
    <div
      className={cn(
        "grid gap-6",
        "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {employees.map((employee, index) => (
        <div
          key={employee.id}
          className="animate-slide-up"
          style={{
            animationDelay: `${Math.min(index * 50, 300)}ms`,
            animationFillMode: "both",
          }}
        >
          <EmployeeCard
            employee={employee}
            index={index}
            stats={statsMap?.[employee.id]}
            onView={onView}
          />
        </div>
      ))}
    </div>
  );
}
