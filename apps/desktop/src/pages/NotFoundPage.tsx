import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center text-center space-y-6 animate-fade-in max-w-md">
        <div className="rounded-2xl bg-muted/60 p-6">
          <FileQuestion className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">404</h1>
          <p className="text-lg text-muted-foreground">
            Page introuvable
          </p>
          <p className="text-sm text-muted-foreground/70 max-w-sm">
            La page que vous recherchez n'existe pas ou a ete deplacee.
          </p>
        </div>

        <Button onClick={() => navigate("/", { replace: true })} className="mt-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour a l'accueil
        </Button>
      </div>
    </div>
  );
}
