import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { ManualEntryForm } from "@/components/manual-entry/ManualEntryForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { PenLine } from "lucide-react";
import type { Operation, CreateOperationInput } from "@insurance/shared";

export function ManualEntryPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (data: CreateOperationInput) => {
    setIsSubmitting(true);
    try {
      await api.post<Operation>("operations", data);
      toast.success("Operation creee avec succes");
    } catch (err: any) {
      const message =
        err?.response
          ? (await err.response.json().catch(() => null))?.error?.message
          : null;
      toast.error(message || "Erreur lors de la creation de l'operation");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <PenLine className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Saisie manuelle
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Entrez les details d'une nouvelle operation d'assurance
          </p>
        </div>
      </div>

      <Card className="max-w-3xl mx-auto animate-slide-up">
        <CardHeader>
          <CardTitle className="text-lg">Nouvelle operation</CardTitle>
          <CardDescription>
            Remplissez les informations ci-dessous pour enregistrer une nouvelle
            operation. Les champs marques sont obligatoires.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManualEntryForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </CardContent>
      </Card>
    </div>
  );
}
