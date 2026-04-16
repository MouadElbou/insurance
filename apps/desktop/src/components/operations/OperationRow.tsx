import type { Operation } from "@insurance/shared";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/format";

interface OperationRowProps {
  operation: Operation;
}

export function OperationRow({ operation }: OperationRowProps) {
  return (
    <>
      <span className="font-mono text-xs">{operation.policy_number}</span>
      <span className="truncate max-w-[160px]">
        {operation.client_name || "-"}
      </span>
      <StatusBadge status={operation.type} />
      <StatusBadge status={operation.source} />
      <CurrencyDisplay value={operation.prime_net} size="sm" />
      <CurrencyDisplay value={operation.commission} size="sm" />
      <span className="text-xs text-muted-foreground">
        {formatDate(operation.effective_date)}
      </span>
      <span className="text-xs text-muted-foreground truncate">
        {operation.employee_name || "-"}
      </span>
    </>
  );
}
