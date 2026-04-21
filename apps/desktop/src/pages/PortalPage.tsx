import { useEffect } from "react";
import { ChevronRight, Globe } from "lucide-react";
import { usePortal } from "@/hooks/usePortal";
import { useInsurerDomains } from "@/hooks/useInsurerDomains";
import { PortalToolbar } from "@/components/scraper/PortalToolbar";
import { PortalLauncher } from "@/components/scraper/PortalLauncher";
import { PortalViewport } from "@/components/scraper/PortalViewport";
import { CaptureStatusBadge } from "@/components/scraper/CaptureStatusBadge";

/**
 * Portail assureur — inline WebContentsView launcher.
 *
 * The main process owns the WebContentsView; this page simply (1) lets the
 * user pick an insurer, (2) reports the viewport bounds so main can position
 * the view correctly, and (3) renders a toolbar with live capture stats.
 */
export function PortalPage() {
  const {
    status,
    stats,
    openPortal,
    closePortal,
    setViewportBounds,
    refreshStats,
  } = usePortal();
  const { domains, isLoading: domainsLoading } = useInsurerDomains();

  // Pull today's stats on mount so the toolbar has numbers from the get-go
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const isIdle = status.status === "IDLE" || status.status === "CLOSED";
  const isOpening = status.status === "OPENING";

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col gap-6 p-8 animate-fade-in">
      {/* Page header */}
      <header className="flex flex-col gap-3">
        <nav className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-on-surface-variant">
          <span>Capture</span>
          <ChevronRight className="h-2.5 w-2.5" />
          <span className="text-primary">Portail assureur</span>
        </nav>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight text-on-surface">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container/40 text-primary">
                <Globe className="h-5 w-5" aria-hidden />
              </span>
              Portail assureur
            </h1>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              Ouvrez un portail assureur autorisé directement depuis
              l'application. Chaque opération validée est capturée et
              transformée automatiquement.
            </p>
          </div>
          {/* Header badge only when idle — PortalToolbar owns the status
              chip whenever a portal is in flight, so showing a second copy
              here produced the "ErreurErreur" / doubled-label artifact. */}
          {isIdle ? (
            <div className="flex items-center gap-3 self-start md:self-auto">
              <CaptureStatusBadge status={status.status} size="md" />
            </div>
          ) : null}
        </div>
      </header>

      {/* Toolbar only once a portal is in flight */}
      {!isIdle ? (
        <PortalToolbar
          status={status}
          stats={stats}
          onClose={async () => {
            await closePortal();
          }}
          onRefreshStats={refreshStats}
        />
      ) : null}

      {/* Viewport: WebContentsView mounted underneath; overlay launcher when idle */}
      <div className="flex-1">
        <PortalViewport
          onBoundsChange={setViewportBounds}
          inactive={isIdle}
        >
          {isIdle ? (
            <div className="absolute inset-0 flex items-center justify-center overflow-auto p-6">
              {domainsLoading ? (
                <div className="flex flex-col items-center gap-3 text-on-surface-variant">
                  <div
                    className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
                    aria-hidden
                  />
                  <p className="text-sm font-medium">
                    Chargement des portails autorisés...
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-4xl">
                  <PortalLauncher
                    domains={domains}
                    isOpening={isOpening}
                    onLaunch={async (insurerCode, startUrl) => {
                      await openPortal(insurerCode, startUrl);
                    }}
                  />
                </div>
              )}
            </div>
          ) : null}
        </PortalViewport>
      </div>
    </div>
  );
}
