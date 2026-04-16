import { useOperationsStore } from "@/stores/operations.store";
import { useEmployeesStore } from "@/stores/employees.store";
import { SearchInput } from "@/components/shared/SearchInput";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import { OPERATION_TYPE_LABELS, OPERATION_SOURCE_LABELS } from "@/lib/constants";

export function OperationsFilters() {
  const filters = useOperationsStore((s) => s.filters);
  const setFilters = useOperationsStore((s) => s.setFilters);
  const resetFilters = useOperationsStore((s) => s.resetFilters);
  const employees = useEmployeesStore((s) => s.employees);

  const hasActiveFilters =
    filters.search ||
    filters.type ||
    filters.source ||
    filters.employee_id ||
    filters.date_from ||
    filters.date_to;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput
        value={filters.search || ""}
        onChange={(search) => setFilters({ search: search || undefined })}
        placeholder="Rechercher par police, client..."
        className="w-64"
      />

      <Select
        value={filters.type || "ALL"}
        onValueChange={(v) =>
          setFilters({ type: v === "ALL" ? undefined : (v as "PRODUCTION" | "EMISSION") })
        }
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Tous les types</SelectItem>
          {Object.entries(OPERATION_TYPE_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.source || "ALL"}
        onValueChange={(v) =>
          setFilters({ source: v === "ALL" ? undefined : (v as "EXCEL" | "MANUAL" | "SCRAPER") })
        }
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Toutes sources</SelectItem>
          {Object.entries(OPERATION_SOURCE_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {employees.length > 0 && (
        <Select
          value={filters.employee_id || "ALL"}
          onValueChange={(v) =>
            setFilters({ employee_id: v === "ALL" || v === null ? undefined : v })
          }
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Employe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tous les employes</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <DateRangePicker
        value={{
          from: filters.date_from ? new Date(filters.date_from) : undefined,
          to: filters.date_to ? new Date(filters.date_to) : undefined,
        }}
        onChange={(range) =>
          setFilters({
            date_from: range.from?.toISOString(),
            date_to: range.to?.toISOString(),
          })
        }
      />

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground hover:text-foreground"
          onClick={resetFilters}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reinitialiser
        </Button>
      )}
    </div>
  );
}
