import type { Employee } from "@insurance/shared";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/shared/SearchInput";
import { EmptyState } from "@/components/shared/EmptyState";
import { EmployeeCard } from "./EmployeeCard";
import { Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployeeListProps {
  employees: Employee[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAdd: () => void;
  onEdit: (employee: Employee) => void;
  onDeactivate: (employee: Employee) => void;
  onView: (employee: Employee) => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-44" />
          <div className="flex gap-2 mt-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </div>
      <Skeleton className="h-3 w-36 mt-2" />
    </div>
  );
}

export function EmployeeList({
  employees,
  isLoading,
  searchQuery,
  onSearchChange,
  onAdd,
  onEdit,
  onDeactivate,
  onView,
}: EmployeeListProps) {
  const hasResults = employees.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Rechercher un employe..."
          className="flex-1"
        />
        <Button size="sm" onClick={onAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          Ajouter un employe
        </Button>
      </div>

      {isLoading ? (
        <div
          className={cn(
            "grid gap-4",
            "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
          )}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : hasResults ? (
        <div
          className={cn(
            "grid gap-4",
            "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
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
                onEdit={onEdit}
                onDeactivate={onDeactivate}
                onView={onView}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title={isSearching ? "Aucun resultat" : "Aucun employe"}
          description={
            isSearching
              ? "Aucun employe ne correspond a votre recherche."
              : "Ajoutez votre premier employe pour commencer."
          }
          action={
            !isSearching
              ? { label: "Ajouter un employe", onClick: onAdd }
              : undefined
          }
        />
      )}
    </div>
  );
}
