import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createOperationSchema,
  type CreateOperationInput,
} from "@insurance/shared";
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
import { FieldGroup } from "@/components/manual-entry/FieldGroup";
import { Loader2, RotateCcw, Save } from "lucide-react";

interface ManualEntryFormProps {
  onSubmit: (data: CreateOperationInput) => Promise<void>;
  isSubmitting: boolean;
}

const defaultValues: CreateOperationInput = {
  type: "PRODUCTION",
  client_id: "",
  client_name: "",
  policy_number: "",
  avenant_number: "",
  quittance_number: "",
  attestation_number: "",
  policy_status: "",
  event_type: "",
  emission_date: undefined,
  effective_date: undefined,
  prime_net: "",
  tax_amount: "",
  parafiscal_tax: "",
  total_prime: "",
  commission: "",
};

export function ManualEntryForm({
  onSubmit,
  isSubmitting,
}: ManualEntryFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateOperationInput>({
    resolver: zodResolver(createOperationSchema),
    defaultValues,
  });

  const currentType = watch("type");

  const handleFormSubmit = async (data: CreateOperationInput) => {
    await onSubmit(data);
  };

  const handleReset = () => {
    reset(defaultValues);
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6 animate-fade-in"
    >
      {/* Type d'operation */}
      <FieldGroup title="Type d'operation">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={currentType}
            onValueChange={(v) =>
              setValue("type", v as "PRODUCTION" | "EMISSION")
            }
          >
            <SelectTrigger className="w-full" aria-invalid={!!errors.type}>
              <SelectValue placeholder="Selectionner un type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRODUCTION">Production</SelectItem>
              <SelectItem value="EMISSION">Emission</SelectItem>
            </SelectContent>
          </Select>
          {errors.type && (
            <p className="text-xs text-destructive">{errors.type.message}</p>
          )}
        </div>
      </FieldGroup>

      {/* Informations client */}
      <FieldGroup title="Informations client">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="client_id">ID Client</Label>
            <Input
              id="client_id"
              {...register("client_id")}
              placeholder="CLT-001"
              className="font-mono"
              aria-invalid={!!errors.client_id}
            />
            {errors.client_id && (
              <p className="text-xs text-destructive">
                {errors.client_id.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="client_name">Nom du client</Label>
            <Input
              id="client_name"
              {...register("client_name")}
              placeholder="Nom du client"
              aria-invalid={!!errors.client_name}
            />
            {errors.client_name && (
              <p className="text-xs text-destructive">
                {errors.client_name.message}
              </p>
            )}
          </div>
        </div>
      </FieldGroup>

      {/* Details de la police */}
      <FieldGroup title="Details de la police">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="policy_number">
              N. Police <span className="text-destructive">*</span>
            </Label>
            <Input
              id="policy_number"
              {...register("policy_number")}
              placeholder="POL-2024-001"
              className="font-mono"
              aria-invalid={!!errors.policy_number}
            />
            {errors.policy_number && (
              <p className="text-xs text-destructive">
                {errors.policy_number.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="avenant_number">N. Avenant</Label>
            <Input
              id="avenant_number"
              {...register("avenant_number")}
              placeholder="AV-001"
              className="font-mono"
              aria-invalid={!!errors.avenant_number}
            />
            {errors.avenant_number && (
              <p className="text-xs text-destructive">
                {errors.avenant_number.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quittance_number">N. Quittance</Label>
            <Input
              id="quittance_number"
              {...register("quittance_number")}
              placeholder="QUI-001"
              className="font-mono"
              aria-invalid={!!errors.quittance_number}
            />
            {errors.quittance_number && (
              <p className="text-xs text-destructive">
                {errors.quittance_number.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="attestation_number">N. Attestation</Label>
            <Input
              id="attestation_number"
              {...register("attestation_number")}
              placeholder="ATT-001"
              className="font-mono"
              aria-invalid={!!errors.attestation_number}
            />
            {errors.attestation_number && (
              <p className="text-xs text-destructive">
                {errors.attestation_number.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="policy_status">Statut police</Label>
            <Input
              id="policy_status"
              {...register("policy_status")}
              placeholder="En vigueur"
              aria-invalid={!!errors.policy_status}
            />
            {errors.policy_status && (
              <p className="text-xs text-destructive">
                {errors.policy_status.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="event_type">Type evenement</Label>
            <Input
              id="event_type"
              {...register("event_type")}
              placeholder="Souscription"
              aria-invalid={!!errors.event_type}
            />
            {errors.event_type && (
              <p className="text-xs text-destructive">
                {errors.event_type.message}
              </p>
            )}
          </div>
        </div>
      </FieldGroup>

      {/* Dates */}
      <FieldGroup title="Dates">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emission_date">Date emission</Label>
            <Input
              id="emission_date"
              type="date"
              {...register("emission_date")}
              aria-invalid={!!errors.emission_date}
            />
            {errors.emission_date && (
              <p className="text-xs text-destructive">
                {errors.emission_date.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="effective_date">Date effet</Label>
            <Input
              id="effective_date"
              type="date"
              {...register("effective_date")}
              aria-invalid={!!errors.effective_date}
            />
            {errors.effective_date && (
              <p className="text-xs text-destructive">
                {errors.effective_date.message}
              </p>
            )}
          </div>
        </div>
      </FieldGroup>

      {/* Montants (MAD) */}
      <FieldGroup title="Montants (MAD)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="prime_net">Prime nette</Label>
            <Input
              id="prime_net"
              {...register("prime_net")}
              placeholder="0.00"
              className="font-mono"
              aria-invalid={!!errors.prime_net}
            />
            {errors.prime_net && (
              <p className="text-xs text-destructive">
                {errors.prime_net.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_amount">Taxes</Label>
            <Input
              id="tax_amount"
              {...register("tax_amount")}
              placeholder="0.00"
              className="font-mono"
              aria-invalid={!!errors.tax_amount}
            />
            {errors.tax_amount && (
              <p className="text-xs text-destructive">
                {errors.tax_amount.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="parafiscal_tax">Taxe parafiscale</Label>
            <Input
              id="parafiscal_tax"
              {...register("parafiscal_tax")}
              placeholder="0.00"
              className="font-mono"
              aria-invalid={!!errors.parafiscal_tax}
            />
            {errors.parafiscal_tax && (
              <p className="text-xs text-destructive">
                {errors.parafiscal_tax.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_prime">Prime totale</Label>
            <Input
              id="total_prime"
              {...register("total_prime")}
              placeholder="0.00"
              className="font-mono"
              aria-invalid={!!errors.total_prime}
            />
            {errors.total_prime && (
              <p className="text-xs text-destructive">
                {errors.total_prime.message}
              </p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="commission">Commission</Label>
            <Input
              id="commission"
              {...register("commission")}
              placeholder="0.00"
              className="font-mono"
              aria-invalid={!!errors.commission}
            />
            {errors.commission && (
              <p className="text-xs text-destructive">
                {errors.commission.message}
              </p>
            )}
          </div>
        </div>
      </FieldGroup>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          disabled={isSubmitting}
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Reinitialiser
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Enregistrer l'operation
        </Button>
      </div>
    </form>
  );
}
