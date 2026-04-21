import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { InsurerDomainInput } from "@insurance/shared";
import { scraperApi } from "@/lib/api";
import { useInsurerDomainsStore } from "@/stores/scraper.store";

/**
 * useInsurerDomains — admin allowlist CRUD.
 * After every mutation we re-push the allowlist to the main process so the
 * PortalManager blocks/unblocks hosts without an app restart.
 */
export function useInsurerDomains() {
  const {
    domains,
    isLoading,
    setDomains,
    setLoading,
    upsert,
    remove,
  } = useInsurerDomainsStore();

  // --------------------------------------------------------- //
  // Load
  // --------------------------------------------------------- //
  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scraperApi.listDomains();
      setDomains(data);
    } catch {
      toast.error("Erreur lors du chargement des domaines assureurs");
      setLoading(false);
    }
  }, [setDomains, setLoading]);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  // --------------------------------------------------------- //
  // Trigger main to re-fetch the allowlist (F4).
  //
  // After B0 + F4 the renderer no longer sends the pattern list over
  // IPC — main re-fetches it authoritatively and rebroadcasts on
  // `scraper:allowlist-sync`. We keep the name `pushAllowlistToMain`
  // as a verb for readers familiar with the old flow, but it's now a
  // trigger-only call.
  // --------------------------------------------------------- //
  const pushAllowlistToMain = useCallback(async () => {
    if (!window.scraperAPI) return;
    const res = await window.scraperAPI.refreshAllowlist();
    if (!res.ok) {
      // Keep this non-blocking — main retains the previous allowlist,
      // so CRUD still succeeded on the server. Surface so the admin
      // knows the renderer-visible patterns may be stale.
      toast.error(
        res.error ??
          "Allowlist pas à jour dans l'application — réessayez le rafraîchissement.",
      );
    }
  }, []);

  // --------------------------------------------------------- //
  // Mutations
  // --------------------------------------------------------- //
  const createDomain = useCallback(
    async (input: InsurerDomainInput) => {
      try {
        const created = await scraperApi.createDomain(input);
        upsert(created);
        await pushAllowlistToMain();
        toast.success("Domaine assureur ajouté.");
        return created;
      } catch (err) {
        const message = await extractMessage(
          err,
          "Impossible d'ajouter le domaine.",
        );
        toast.error(message);
        throw err;
      }
    },
    [upsert, pushAllowlistToMain],
  );

  const updateDomain = useCallback(
    async (id: string, input: Partial<InsurerDomainInput>) => {
      const current = domains.find((d) => d.id === id);
      if (!current) {
        toast.error("Domaine introuvable.");
        throw new Error(`Domain ${id} not found in store`);
      }
      const body: InsurerDomainInput = {
        host_pattern: input.host_pattern ?? current.host_pattern,
        insurer_code: input.insurer_code ?? current.insurer_code,
        label: input.label ?? current.label,
        capture_enabled: input.capture_enabled ?? current.capture_enabled,
      };
      try {
        const updated = await scraperApi.updateDomain(id, body);
        upsert(updated);
        await pushAllowlistToMain();
        toast.success("Domaine mis à jour.");
        return updated;
      } catch (err) {
        const message = await extractMessage(
          err,
          "Impossible de mettre à jour le domaine.",
        );
        toast.error(message);
        throw err;
      }
    },
    [domains, upsert, pushAllowlistToMain],
  );

  const toggleDomain = useCallback(
    (id: string, capture_enabled: boolean) =>
      updateDomain(id, { capture_enabled }),
    [updateDomain],
  );

  const deleteDomain = useCallback(
    async (id: string) => {
      try {
        await scraperApi.deleteDomain(id);
        remove(id);
        await pushAllowlistToMain();
        toast.success("Domaine supprimé.");
      } catch (err) {
        const message = await extractMessage(
          err,
          "Impossible de supprimer le domaine.",
        );
        toast.error(message);
      }
    },
    [remove, pushAllowlistToMain],
  );

  return {
    domains,
    isLoading,
    createDomain,
    updateDomain,
    toggleDomain,
    deleteDomain,
    refetch: fetchDomains,
  };
}

async function extractMessage(err: unknown, fallback: string): Promise<string> {
  if (err && typeof err === "object" && "response" in err) {
    try {
      const response = (err as { response: Response }).response;
      const body = (await response.json()) as {
        error?: { message?: string };
      };
      if (body.error?.message) return body.error.message;
    } catch {
      // fall through
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
