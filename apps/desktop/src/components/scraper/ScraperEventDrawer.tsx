import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileJson,
  Inbox,
  RefreshCw,
  RotateCcw,
  Server,
  User,
} from "lucide-react";
import type { ScraperEventDetail } from "@insurance/shared";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import {
  TRANSFORMER_VERDICT_COLORS,
  TRANSFORMER_VERDICT_LABELS,
} from "@/lib/constants";

interface ScraperEventDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ScraperEventDetail | null;
  isDetailLoading: boolean;
  isReplaying: boolean;
  onReplay: (id: string) => void;
}

/**
 * Right-hand drawer that exposes the full anatomy of a captured HTTP event:
 * a quick overview, the outbound request, the inbound response, and a raw
 * JSON dump. Manager uses this surface to diagnose failed transformers and
 * reinject events into the pipeline when appropriate.
 */
export function ScraperEventDrawer({
  open,
  onOpenChange,
  detail,
  isDetailLoading,
  isReplaying,
  onReplay,
}: ScraperEventDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[720px] sm:max-w-[720px] overflow-hidden border-l border-outline-variant/30 bg-surface"
      >
        {isDetailLoading && !detail ? (
          <DrawerSkeleton />
        ) : !detail ? (
          <DrawerEmptyState />
        ) : (
          <DrawerBody
            detail={detail}
            isReplaying={isReplaying}
            onReplay={onReplay}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

function DrawerBody({
  detail,
  isReplaying,
  onReplay,
}: {
  detail: ScraperEventDetail;
  isReplaying: boolean;
  onReplay: (id: string) => void;
}) {
  const navigate = useNavigate();
  const verdictLabel =
    TRANSFORMER_VERDICT_LABELS[detail.transformer_verdict] ??
    detail.transformer_verdict;
  const verdictColor =
    TRANSFORMER_VERDICT_COLORS[detail.transformer_verdict] ?? "";
  const isError = detail.transformer_verdict === "ERROR";

  return (
    <div className="flex h-full flex-col">
      <SheetHeader className="border-b border-outline-variant/20 bg-surface-container-lowest px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex min-w-[3.5rem] items-center justify-center rounded-md bg-surface-container px-2 py-1 text-[11px] font-bold uppercase tracking-wider tabular-nums",
                  methodTone(detail.method),
                )}
              >
                {detail.method}
              </span>
              <StatusChip code={detail.status_code} />
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  verdictColor,
                )}
              >
                {isError ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
                {verdictLabel}
              </span>
            </div>
            <SheetTitle className="truncate text-base font-bold text-on-surface">
              {detail.host}
            </SheetTitle>
            <SheetDescription
              className="break-all font-mono text-xs text-on-surface-variant"
              title={detail.pathname}
            >
              {detail.pathname}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <Tabs defaultValue="overview" className="gap-4">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="overview">Aperçu</TabsTrigger>
            <TabsTrigger value="request">Requête</TabsTrigger>
            <TabsTrigger value="response">Réponse</TabsTrigger>
            <TabsTrigger value="raw">Brut</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            {isError && detail.transformer_notes ? (
              <ErrorBanner message={detail.transformer_notes} />
            ) : null}

            <UrlBlock url={detail.url} />

            <MetaGrid>
              <MetaItem
                icon={User}
                label="Opérateur"
                value={`${detail.employee.full_name} (${detail.employee.operator_code})`}
              />
              <MetaItem
                icon={Clock}
                label="Capturé le"
                value={formatDateTime(detail.captured_at)}
              />
              <MetaItem
                icon={RefreshCw}
                label="Traité le"
                value={
                  detail.processed_at
                    ? formatDateTime(detail.processed_at)
                    : "En attente"
                }
              />
              <MetaItem
                icon={Clock}
                label="Durée"
                value={
                  detail.duration_ms === null
                    ? "—"
                    : detail.duration_ms < 1000
                      ? `${detail.duration_ms} ms`
                      : `${(detail.duration_ms / 1000).toFixed(2)} s`
                }
              />
              <MetaItem
                icon={Server}
                label="Assureur"
                value={detail.insurer_code ?? "Inconnu"}
              />
            </MetaGrid>

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                <FileJson className="h-3.5 w-3.5" aria-hidden />
                Opérations générées
              </h3>
              {detail.operation_ids.length === 0 ? (
                <p className="rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-lowest px-4 py-6 text-center text-sm italic text-on-surface-variant">
                  Aucune opération n'a été émise par ce paquet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detail.operation_ids.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => navigate(`/operations/${id}`)}
                      className="group inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-1.5 font-mono text-[11px] font-semibold text-primary transition-all hover:border-primary/40 hover:bg-primary-container/20"
                    >
                      <span className="truncate max-w-[180px]">
                        {id}
                      </span>
                      <ArrowUpRight
                        className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="request" className="space-y-4">
            <HeaderTable
              title="En-têtes de requête"
              headers={detail.request_headers}
            />
            <BodyBlock title="Corps de requête" body={detail.request_body} />
          </TabsContent>

          <TabsContent value="response" className="space-y-4">
            <HeaderTable
              title="En-têtes de réponse"
              headers={detail.response_headers}
            />
            <BodyBlock title="Corps de réponse" body={detail.response_body} />
          </TabsContent>

          <TabsContent value="raw">
            <RawBlock detail={detail} />
          </TabsContent>
        </Tabs>
      </div>

      <SheetFooter className="border-t border-outline-variant/20 bg-surface-container-lowest px-6 py-4">
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-xs italic text-on-surface-variant">
            Identifiant événement{" "}
            <span className="font-mono text-on-surface">{detail.id}</span>
          </p>
          {isError ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => onReplay(detail.id)}
              disabled={isReplaying}
            >
              <RotateCcw
                className={cn(
                  "h-3.5 w-3.5",
                  isReplaying && "animate-spin",
                )}
                aria-hidden
              />
              {isReplaying ? "Réinjection..." : "Rejouer"}
            </Button>
          ) : null}
        </div>
      </SheetFooter>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header helpers
// ---------------------------------------------------------------------------

function StatusChip({ code }: { code: number | null }) {
  if (code === null) {
    return (
      <span className="inline-flex items-center rounded-md bg-surface-container px-2 py-0.5 text-[11px] font-bold text-outline">
        —
      </span>
    );
  }
  const tone =
    code >= 500
      ? "bg-error-container text-on-error-container"
      : code >= 400
        ? "bg-tertiary-container text-on-tertiary-container"
        : code >= 300
          ? "bg-surface-container text-on-surface-variant"
          : code >= 200
            ? "bg-secondary-container text-on-secondary-container"
            : "bg-surface-container text-on-surface-variant";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums",
        tone,
      )}
    >
      {code}
    </span>
  );
}

function methodTone(method: string): string {
  const m = method.toUpperCase();
  if (m === "GET") return "text-secondary";
  if (m === "POST") return "text-primary";
  if (m === "PUT" || m === "PATCH") return "text-tertiary";
  if (m === "DELETE") return "text-error";
  return "text-on-surface";
}

// ---------------------------------------------------------------------------
// Overview helpers
// ---------------------------------------------------------------------------

function MetaGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 sm:grid-cols-2">
      {children}
    </div>
  );
}

function UrlBlock({ url }: { url: string }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          URL complète
        </h3>
        <CopyButton value={url} />
      </div>
      <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap break-all rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 font-mono text-[11px] leading-relaxed text-on-surface">
        {url}
      </pre>
    </section>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant"
        aria-hidden
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <span
          className={cn(
            "truncate text-sm font-semibold text-on-surface",
            mono && "font-mono text-xs",
          )}
          title={value}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-error/30 bg-error-container/40 p-4">
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-error"
        aria-hidden
      />
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-bold uppercase tracking-widest text-error">
          Erreur du transformeur
        </h4>
        <p className="break-words text-sm font-medium text-on-error-container">
          {message}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Headers & body blocks
// ---------------------------------------------------------------------------

function HeaderTable({
  title,
  headers,
}: {
  title: string;
  headers: Record<string, string> | null;
}) {
  const entries = useMemo(
    () => (headers ? Object.entries(headers) : []),
    [headers],
  );
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        {title}
      </h3>
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-lowest px-4 py-4 text-sm italic text-on-surface-variant">
          Aucun en-tête enregistré.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-lowest">
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-outline-variant/10">
              {entries.map(([k, v]) => (
                <tr key={k}>
                  <td className="w-1/3 whitespace-nowrap bg-surface-container-low/40 px-3 py-2 align-top font-mono text-[11px] font-bold text-on-surface-variant">
                    {k}
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-[11px] break-all text-on-surface">
                    {v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BodyBlock({ title, body }: { title: string; body: string | null }) {
  const prettified = useMemo(() => prettifyJson(body), [body]);
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          {title}
        </h3>
        {body ? <CopyButton value={prettified} /> : null}
      </div>
      {body === null || body === "" ? (
        <p className="rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-lowest px-4 py-4 text-sm italic text-on-surface-variant">
          Corps vide ou non capturé.
        </p>
      ) : (
        <pre className="max-h-[360px] overflow-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 font-mono text-[11px] leading-relaxed text-on-surface">
          {prettified}
        </pre>
      )}
    </section>
  );
}

function RawBlock({ detail }: { detail: ScraperEventDetail }) {
  const json = useMemo(() => JSON.stringify(detail, null, 2), [detail]);
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Événement complet (JSON)
        </h3>
        <CopyButton value={json} />
      </div>
      <pre className="max-h-[520px] overflow-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 font-mono text-[11px] leading-relaxed text-on-surface">
        {json}
      </pre>
    </section>
  );
}

function prettifyJson(value: string | null): string {
  if (!value) return "";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silently ignore clipboard failures in non-secure contexts.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 py-1 text-[11px] font-semibold text-on-surface-variant transition-all hover:border-primary/40 hover:text-primary"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" aria-hidden />
          Copié
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" aria-hidden />
          Copier
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading & empty states
// ---------------------------------------------------------------------------

function DrawerSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-outline-variant/20 bg-surface-container-lowest px-6 py-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function DrawerEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-low">
        <Inbox className="h-6 w-6 text-outline" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-on-surface">
        Aucun événement sélectionné
      </h3>
      <p className="max-w-sm text-sm text-on-surface-variant">
        Cliquez sur une ligne du tableau pour inspecter la requête, la réponse
        et le JSON brut capturés depuis le portail.
      </p>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="pointer-events-none hidden items-center gap-1 text-xs text-outline"
        aria-hidden
      >
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
