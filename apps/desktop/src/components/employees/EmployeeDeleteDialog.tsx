import type { Employee } from "@insurance/shared";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useState } from "react";

interface EmployeeDeleteDialogProps {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function EmployeeDeleteDialog({
  employee,
  open,
  onOpenChange,
  onConfirm,
}: EmployeeDeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (!employee) return;
    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Desactiver l'employe"
      description={
        employee
          ? `Etes-vous sur de vouloir desactiver ${employee.full_name} ? Cette action est reversible.`
          : undefined
      }
      confirmLabel="Desactiver"
      onConfirm={handleConfirm}
      variant="destructive"
      isLoading={isLoading}
    />
  );
}
