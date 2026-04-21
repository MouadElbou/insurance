import { FormEvent, useEffect, useState } from "react";
import { Globe, Loader2, ShieldCheck, Tag } from "lucide-react";
import type { InsurerDomain, InsurerDomainInput } from "@insurance/shared";
import { isSafeRegexSource } from "@insurance/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface InsurerDomainFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: InsurerDomain | null;
  isSaving: boolean;
  onSubmit: (input: InsurerDomainInput) => void | Promise<void>;
}

const EMPTY_STATE: InsurerDomainInput = {
  host_pattern: "",
  insurer_code: "",
  label: "",
  capture_enabled: true,
};

/**
 * Modal form used to create or edit an allow-listed insurer domain. The
 * parent hook handles toasts — this form stays silent on success and
 * just closes itself.
 */
export function InsurerDomainForm({
  open,
  onOpenChange,
  initial,
  isSaving,
  onSubmit,
}: InsurerDomainFormProps) {
  const [state, setState] = useState<InsurerDomainInput>(EMPTY_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof InsurerDomainInput, string>>>({});

  // Reset when opening/closing or when switching between create/edit modes
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setState({
        host_pattern: initial.host_pattern,
        insurer_code: initial.insurer_code,
        label: initial.label,
        capture_enabled: initial.capture_enabled,
      });
    } else {
      setState(EMPTY_STATE);
    }
    setErrors({});
  }, [initial, open]);

  function validate(): boolean {
    const next: Partial<Record<keyof InsurerDomainInput, string>> = {};
    const host = state.host_pattern.trim();
    const code = state.insurer_code.trim();
    const label = state.label.trim();

    // --- host_pattern ---
    //
    // F5: the server treats host_pattern as a real regex source (it
    // compiles it via `new RegExp(...)` and matches against the incoming
    // URL host). Validating it as a glob here would have accepted
    // globs that the server then rejects, and worse, would have let
    // through ReDoS-prone patterns like "^(a+)+$" before the server saw
    // them. We mirror the server's two-layer check:
    //
    //   1. `isSafeRegexSource` statically rejects nested quantifiers,
    //      oversize bounded repeats, and patterns >1000 chars. This is
    //      the safety floor — without it, `new RegExp(...)` below would
    //      happily compile a ReDoS pattern.
    //   2. `new RegExp(...)` inside a try/catch catches everything else
    //      (unterminated groups, invalid escapes, etc).
    //
    // We also require the pattern to be anchored with a trailing `$`.
    // The host regex is applied to `URL.host`, which never contains a
    // path — an unanchored pattern like `rmaassurance\.com` would
    // match `rmaassurance.com.evil.example` and silently widen the
    // allowlist. The leading `^` is optional because the backend adds
    // it if missing, but enforcing `$` catches the common "I forgot to
    // anchor" mistake at write time.
    if (!host) {
      next.host_pattern = "Le motif d'hôte est requis";
    } else if (!host.endsWith("$")) {
      next.host_pattern =
        "Le motif doit être ancré par $ (ex: ^(www\\.)?rmaassurance\\.com$)";
    } else if (!isSafeRegexSource(host)) {
      next.host_pattern =
        "Motif rejeté : quantificateurs imbriqués ou trop larges (ReDoS)";
    } else {
      try {
        new RegExp(host, "i");
      } catch {
        next.host_pattern = "Expression régulière invalide";
      }
    }

    // F5: shared schema uses /^[A-Z0-9_]{2,16}$/ — align to avoid a
    // client-passes / server-rejects round-trip. Hyphens removed
    // because Prisma enum identifiers can't contain them, and the
    // label field is where the human-readable name lives.
    if (!code) {
      next.insurer_code = "Le code assureur est requis";
    } else if (!/^[A-Z0-9_]{2,16}$/.test(code)) {
      next.insurer_code =
        "2 à 16 caractères : lettres majuscules, chiffres, tirets bas";
    }

    if (!label) {
      next.label = "Le libellé est requis";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    if (!validate()) return;

    try {
      await onSubmit({
        host_pattern: state.host_pattern.trim(),
        insurer_code: state.insurer_code.trim().toUpperCase(),
        label: state.label.trim(),
        capture_enabled: state.capture_enabled,
      });
      onOpenChange(false);
    } catch {
      // Hook already toasted the error; keep the dialog open so the user
      // can correct their input instead of losing their work.
    }
  }

  const isEdit = Boolean(initial);

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && isSaving) return;
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {isEdit ? "Modifier le domaine" : "Ajouter un domaine assureur"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mettez à jour le motif d'hôte ou désactivez la capture pour suspendre les événements de cet assureur."
              : "Déclarez un nouveau portail assureur autorisé. Seuls les domaines listés ici peuvent être chargés dans le scraper."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-outline">
              <Globe className="h-3.5 w-3.5" aria-hidden />
              Motif d'hôte
            </label>
            <Input
              type="text"
              placeholder="^(www\.)?rmaassurance\.com$"
              value={state.host_pattern}
              onChange={(e) =>
                setState((prev) => ({ ...prev, host_pattern: e.target.value }))
              }
              className="h-10 font-mono text-sm"
              aria-invalid={Boolean(errors.host_pattern)}
              autoFocus={!isEdit}
            />
            {errors.host_pattern ? (
              <p className="text-xs font-medium text-error">
                {errors.host_pattern}
              </p>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Expression régulière appliquée à l'hôte de l'URL. Ancrez-la
                toujours avec <code className="font-mono">$</code>.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-outline">
                <Tag className="h-3.5 w-3.5" aria-hidden />
                Code assureur
              </label>
              <Input
                type="text"
                placeholder="AXA"
                value={state.insurer_code}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    insurer_code: e.target.value.toUpperCase(),
                  }))
                }
                className="h-10 font-mono text-sm uppercase"
                aria-invalid={Boolean(errors.insurer_code)}
                maxLength={16}
              />
              {errors.insurer_code ? (
                <p className="text-xs font-medium text-error">
                  {errors.insurer_code}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-outline">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Libellé affiché
              </label>
              <Input
                type="text"
                placeholder="AXA Assurance Maroc"
                value={state.label}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, label: e.target.value }))
                }
                className="h-10"
                aria-invalid={Boolean(errors.label)}
              />
              {errors.label ? (
                <p className="text-xs font-medium text-error">{errors.label}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-outline-variant/40 bg-surface-container-low/40 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-on-surface">
                Capture activée
              </p>
              <p className="text-xs text-on-surface-variant">
                Lorsqu'elle est désactivée, ce portail peut toujours être
                ouvert mais aucun événement n'est enregistré.
              </p>
            </div>
            <Switch
              checked={state.capture_enabled}
              onCheckedChange={(value) =>
                setState((prev) => ({ ...prev, capture_enabled: value }))
              }
              aria-label="Activer la capture"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
