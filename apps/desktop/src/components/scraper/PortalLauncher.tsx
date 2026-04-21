import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Globe, ShieldCheck, Sparkles } from "lucide-react";
import type { InsurerDomain } from "@insurance/shared";
import { isSafeRegexSource } from "@insurance/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PortalLauncherProps {
  domains: InsurerDomain[];
  isOpening?: boolean;
  onLaunch: (insurerCode: string, startUrl: string) => void | Promise<void>;
}

/**
 * Full-width landing state shown inside the portal viewport when no portal
 * is open. Lets the broker pick an allow-listed insurer and optionally type
 * a custom start URL (sub-path of the host).
 */
export function PortalLauncher({
  domains,
  isOpening,
  onLaunch,
}: PortalLauncherProps) {
  const enabled = useMemo(
    () => domains.filter((d) => d.capture_enabled),
    [domains],
  );
  // Keyed by domain id, not insurer_code — a single insurer_code (e.g. "RMA")
  // can back several distinct portal hosts (rmaassurance.com, gama.*,
  // rmastore.*, portail.*). Keying the dropdown on insurer_code collapsed
  // them all to the first row and silently opened the wrong URL.
  const [domainId, setDomainId] = useState<string | undefined>(enabled[0]?.id);
  const [customUrl, setCustomUrl] = useState("");

  const selected = useMemo(
    () => enabled.find((d) => d.id === domainId) ?? null,
    [enabled, domainId],
  );

  // F2 — client-side echo of the server allowlist check.
  //
  // Compile the selected insurer's host regex once per selection (not per
  // keystroke) and fall back to `null` if the compile fails. `null` disables
  // the echo entirely so a corrupt row cannot wedge the launcher UI — the
  // server-side check in `PortalManager.open()` is still authoritative.
  //
  // We apply `isSafeRegexSource` up front because an attacker who slipped a
  // ReDoS row past the server guard would otherwise be able to freeze the
  // renderer just by opening the launcher. The server remains the source
  // of truth; this is defense-in-depth at the UI layer.
  const hostMatcher = useMemo(() => {
    if (!selected) return null;
    if (!isSafeRegexSource(selected.host_pattern)) return null;
    try {
      return new RegExp(selected.host_pattern, "i");
    } catch {
      return null;
    }
  }, [selected]);

  // Validate whatever the user typed. Empty input = will use inferStartUrl,
  // which is derived from the allow-listed host_pattern and always matches.
  const urlValidation = useMemo<
    { state: "idle" | "ok" | "error"; message?: string }
  >(() => {
    const trimmed = customUrl.trim();
    if (trimmed === "") return { state: "idle" };
    if (!selected) return { state: "idle" };
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return {
        state: "error",
        message: "URL invalide — incluez le schéma https://",
      };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        state: "error",
        message: "Seuls les schémas http(s) sont autorisés.",
      };
    }
    if (!hostMatcher || !hostMatcher.test(parsed.host)) {
      return {
        state: "error",
        message: `L'hôte « ${parsed.host} » ne correspond pas au modèle autorisé de ${selected.label}.`,
      };
    }
    return { state: "ok" };
  }, [customUrl, hostMatcher, selected]);

  const canSubmit =
    Boolean(selected) && !isOpening && urlValidation.state !== "error";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    // Server-side authoritative — PortalManager.open() re-validates the
    // URL host against the insurer's compiled regex and rejects mismatches
    // with a French toast. This client echo only makes the UI feel direct.
    if (urlValidation.state === "error") return;
    const url = customUrl.trim() || inferStartUrl(selected.host_pattern);
    await onLaunch(selected.insurer_code, url);
  }

  if (enabled.length === 0) {
    return (
      <EmptyState
        title="Aucun portail assureur configuré"
        description="Demandez à un gestionnaire d'ajouter un domaine dans « Domaines assureurs » avant de démarrer une capture."
      />
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-3xl border border-outline-variant/40 bg-gradient-to-br from-primary-container/30 via-surface-container-lowest to-secondary-container/20 p-10"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-secondary/10 blur-3xl" />

      <div className="relative mx-auto flex max-w-2xl flex-col items-start gap-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary-container/60 px-3 py-1 text-xs font-semibold text-on-primary-container">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Capture intelligente
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">
            Prêt à ouvrir un portail assureur
          </h2>
          <p className="max-w-xl text-sm text-on-surface-variant">
            Sélectionnez l'assureur ci-dessous. Le portail s'ouvrira dans une
            fenêtre intégrée et chaque opération validée sera automatiquement
            enregistrée dans le pipeline.
          </p>
        </div>

        <div className="grid w-full gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-outline">
              <Globe className="h-3.5 w-3.5" aria-hidden />
              Assureur
            </span>
            <Select
              value={domainId}
              onValueChange={(value) =>
                setDomainId(typeof value === "string" ? value : undefined)
              }
            >
              <SelectTrigger className="w-full h-10 bg-surface-container-lowest">
                <SelectValue placeholder="Sélectionner un assureur" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {enabled.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex flex-col gap-0.5 text-left">
                        <span className="font-semibold">{d.label}</span>
                        <span className="text-[11px] text-on-surface-variant">
                          {d.host_pattern}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>

          <label className="space-y-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-outline">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              URL personnalisée (optionnel)
            </span>
            <Input
              type="url"
              placeholder={
                selected ? inferStartUrl(selected.host_pattern) : "https://..."
              }
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              aria-invalid={urlValidation.state === "error"}
              aria-describedby={
                urlValidation.state === "error"
                  ? "portal-launcher-url-error"
                  : undefined
              }
              className={cn(
                "h-10 bg-surface-container-lowest",
                urlValidation.state === "error" &&
                  "border-error focus-visible:ring-error/40",
              )}
            />
            {urlValidation.state === "error" && urlValidation.message && (
              <p
                id="portal-launcher-url-error"
                role="alert"
                className="flex items-start gap-1.5 text-xs font-medium text-error"
              >
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                  aria-hidden
                />
                <span>{urlValidation.message}</span>
              </p>
            )}
          </label>
        </div>

        <div className="flex w-full flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
            Seuls les hôtes autorisés peuvent être chargés.
          </div>
          <Button
            type="submit"
            size="lg"
            className={cn(
              "gap-2 shadow-lg shadow-primary/30",
              !canSubmit && "opacity-70",
            )}
            disabled={!canSubmit}
          >
            <Globe className="h-4 w-4" aria-hidden />
            {isOpening ? "Ouverture..." : "Ouvrir le portail"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function inferStartUrl(hostPattern: string): string {
  // `host_pattern` is an anchored regex source (e.g. `^(www\.)?rmaassurance\.com$`),
  // not a glob. Strip anchors, optional groups, and backslash-escapes to recover
  // a concrete host suitable for the address bar. Fallback to the raw pattern if
  // unrecognised so the user still sees *something* instead of a blank URL.
  const host = hostPattern
    .replace(/^\^/, "")
    .replace(/\$$/, "")
    .replace(/\(www\\\.\)\?/g, "")
    .replace(/\([^)]*\)\??/g, "")
    .replace(/\\\./g, ".")
    .replace(/^\*\./, "")
    .replace(/^https?:\/\//, "")
    .trim();
  const firstSegment = host.split("/")[0] || hostPattern;
  return `https://${firstSegment}/`;
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-outline-variant/60 bg-surface-container-lowest px-6 py-16 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-low">
        <Globe className="h-6 w-6 text-outline" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold text-on-surface">{title}</h3>
      <p className="max-w-md text-sm text-on-surface-variant">{description}</p>
    </div>
  );
}
