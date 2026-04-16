import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
} from "@insurance/shared";
import type { Employee } from "@insurance/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSubmit: (data: CreateEmployeeInput | UpdateEmployeeInput) => Promise<void>;
}

export function EmployeeForm({
  open,
  onOpenChange,
  employee,
  onSubmit,
}: EmployeeFormProps) {
  const isEdit = !!employee;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = isEdit ? updateEmployeeSchema : createEmployeeSchema;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(schema as any),
    defaultValues: {
      email: "",
      password: "",
      full_name: "",
      operator_code: "",
      role: "EMPLOYEE",
    },
  });

  const currentRole = watch("role");

  useEffect(() => {
    if (open && employee) {
      reset({
        email: employee.email,
        password: "",
        full_name: employee.full_name,
        operator_code: employee.operator_code,
        role: employee.role,
      });
    } else if (open) {
      reset({
        email: "",
        password: "",
        full_name: "",
        operator_code: "",
        role: "EMPLOYEE",
      });
    }
  }, [open, employee, reset]);

  const handleFormSubmit = async (data: CreateEmployeeInput) => {
    setIsSubmitting(true);
    try {
      if (isEdit) {
        // Strip empty password for updates
        const updateData: UpdateEmployeeInput = { ...data };
        if (!updateData.password) {
          delete updateData.password;
        }
        await onSubmit(updateData);
      } else {
        await onSubmit(data);
      }
      onOpenChange(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'employe" : "Ajouter un employe"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifiez les informations de l'employe."
              : "Remplissez les informations pour creer un nouvel employe."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="space-y-4 py-2"
        >
          <div className="space-y-2">
            <Label htmlFor="full_name">Nom complet</Label>
            <Input
              id="full_name"
              {...register("full_name")}
              placeholder="Jean Dupont"
              aria-invalid={!!errors.full_name}
            />
            {errors.full_name && (
              <p className="text-xs text-destructive">
                {errors.full_name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="jean@example.com"
              aria-invalid={!!errors.email}
            />
            {errors.email && (
              <p className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {isEdit ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
            </Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              placeholder={isEdit ? "Laisser vide pour ne pas modifier" : "Min. 8 caracteres"}
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="operator_code">Code operateur</Label>
              <Input
                id="operator_code"
                {...register("operator_code")}
                placeholder="OP001"
                className="font-mono"
                aria-invalid={!!errors.operator_code}
              />
              {errors.operator_code && (
                <p className="text-xs text-destructive">
                  {errors.operator_code.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={currentRole}
                onValueChange={(v) =>
                  setValue("role", v as "MANAGER" | "EMPLOYEE")
                }
              >
                <SelectTrigger aria-invalid={!!errors.role}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employe</SelectItem>
                  <SelectItem value="MANAGER">Responsable</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-xs text-destructive">
                  {errors.role.message}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {isEdit ? "Enregistrer" : "Creer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
