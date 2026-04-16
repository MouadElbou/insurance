import type { Operation } from "@insurance/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate, formatDateTime } from "@/lib/format";

interface OperationDetailPanelProps {
  operation: Operation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="text-sm text-right">{children}</div>
    </div>
  );
}

export function OperationDetailPanel({
  operation,
  open,
  onOpenChange,
}: OperationDetailPanelProps) {
  if (!operation) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-base">
              {operation.policy_number}
            </span>
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <StatusBadge status={operation.type} />
            <StatusBadge status={operation.source} />
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 animate-fade-in">
          {/* Client info */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Informations client
            </h4>
            <div className="rounded-lg border p-3 space-y-0">
              <DetailRow label="Client">
                <span>{operation.client_name || "-"}</span>
              </DetailRow>
              <DetailRow label="ID Client">
                <span className="font-mono text-xs">
                  {operation.client_id || "-"}
                </span>
              </DetailRow>
            </div>
          </div>

          {/* Policy details */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Details de la police
            </h4>
            <div className="rounded-lg border p-3 space-y-0">
              <DetailRow label="N. Police">
                <span className="font-mono">{operation.policy_number}</span>
              </DetailRow>
              <DetailRow label="N. Avenant">
                <span className="font-mono">
                  {operation.avenant_number || "-"}
                </span>
              </DetailRow>
              <DetailRow label="N. Quittance">
                <span className="font-mono">
                  {operation.quittance_number || "-"}
                </span>
              </DetailRow>
              <DetailRow label="N. Attestation">
                <span className="font-mono">
                  {operation.attestation_number || "-"}
                </span>
              </DetailRow>
              <DetailRow label="Statut police">
                <span>{operation.policy_status || "-"}</span>
              </DetailRow>
              <DetailRow label="Type evenement">
                <span>{operation.event_type || "-"}</span>
              </DetailRow>
            </div>
          </div>

          {/* Dates */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Dates
            </h4>
            <div className="rounded-lg border p-3 space-y-0">
              <DetailRow label="Date emission">
                <span>{formatDate(operation.emission_date)}</span>
              </DetailRow>
              <DetailRow label="Date effet">
                <span>{formatDate(operation.effective_date)}</span>
              </DetailRow>
              <DetailRow label="Date de creation">
                <span>{formatDateTime(operation.created_at)}</span>
              </DetailRow>
            </div>
          </div>

          <Separator />

          {/* Financial */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Montants
            </h4>
            <div className="rounded-lg border p-3 space-y-0">
              <DetailRow label="Prime nette">
                <CurrencyDisplay value={operation.prime_net} size="sm" />
              </DetailRow>
              <DetailRow label="Taxes">
                <CurrencyDisplay value={operation.tax_amount} size="sm" />
              </DetailRow>
              <DetailRow label="Taxe parafiscale">
                <CurrencyDisplay value={operation.parafiscal_tax} size="sm" />
              </DetailRow>
              <div className="border-t mt-2 pt-2">
                <DetailRow label="Prime totale">
                  <CurrencyDisplay
                    value={operation.total_prime}
                    size="sm"
                    className="font-semibold"
                  />
                </DetailRow>
              </div>
              <div className="border-t mt-2 pt-2">
                <DetailRow label="Commission">
                  <CurrencyDisplay
                    value={operation.commission}
                    size="sm"
                    className="text-primary font-semibold"
                  />
                </DetailRow>
              </div>
            </div>
          </div>

          {/* Employee */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Employe
            </h4>
            <div className="rounded-lg border p-3">
              <DetailRow label="Nom">
                <span>{operation.employee_name || "-"}</span>
              </DetailRow>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
