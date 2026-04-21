import type { TopEmployee } from "@insurance/shared";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  data: TopEmployee[];
  isLoading: boolean;
}

export function TopEmployeesChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm flex flex-col space-y-6">
        <div>
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-52" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  const maxCommission = Math.max(...data.map((d) => d.total_commission), 1);

  return (
    <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm flex flex-col h-full">
      <div className="mb-8">
        <h4 className="text-lg font-bold text-on-surface">Top Collaborateurs</h4>
        <p className="text-sm text-outline font-medium">
          Par volume de commissions
        </p>
      </div>
      <div className="flex-1 space-y-6">
        {data.slice(0, 4).map((employee) => {
          const pct = Math.round(
            (employee.total_commission / maxCommission) * 100,
          );
          const formatted = new Intl.NumberFormat("fr-FR").format(
            employee.total_commission,
          );
          return (
            <div key={employee.employee_id} className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold">
                <span>{employee.employee_name}</span>
                <span className="tabular-nums">{formatted} MAD</span>
              </div>
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <button className="mt-6 text-primary text-xs font-bold uppercase tracking-widest hover:underline text-center w-full">
        Voir tout le classement
      </button>
    </div>
  );
}
