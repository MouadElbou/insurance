import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ScraperEventDetail } from "@insurance/shared";
import { scraperApi } from "@/lib/api";
import { useScraperEventsStore } from "@/stores/scraper.store";

/**
 * useScraperEvents — MANAGER reporting hook.
 * Fetches the paginated list reactively when filters change, with in-flight
 * cancellation and a small detail cache for the drawer view.
 */
export function useScraperEvents() {
  const {
    events,
    pagination,
    filters,
    selectedEventId,
    isLoading,
    setEvents,
    setLoading,
    selectEvent,
  } = useScraperEventsStore();

  const [detail, setDetail] = useState<ScraperEventDetail | null>(null);
  const [isDetailLoading, setDetailLoading] = useState(false);
  const [isReplaying, setReplaying] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // --------------------------------------------------------- //
  // List
  // --------------------------------------------------------- //
  const fetchEvents = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const data = await scraperApi.listEvents(filters);
      setEvents(data);
    } catch (err) {
      const isAbort =
        typeof err === "object" &&
        err !== null &&
        (err as { name?: string }).name === "AbortError";
      if (!isAbort) {
        toast.error("Erreur lors du chargement des événements scraper");
        setLoading(false);
      }
    }
  }, [filters, setEvents, setLoading]);

  useEffect(() => {
    fetchEvents();
    return () => abortRef.current?.abort();
  }, [fetchEvents]);

  // --------------------------------------------------------- //
  // Detail
  // --------------------------------------------------------- //
  useEffect(() => {
    let cancelled = false;
    if (!selectedEventId) {
      setDetail(null);
      return () => {
        cancelled = true;
      };
    }
    setDetailLoading(true);
    scraperApi
      .getEvent(selectedEventId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Impossible de charger le détail de l'événement.");
          setDetail(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEventId]);

  // --------------------------------------------------------- //
  // Replay
  // --------------------------------------------------------- //
  const replay = useCallback(
    async (id: string) => {
      setReplaying(true);
      try {
        const updated = await scraperApi.replayEvent(id);
        setDetail(updated);
        toast.success("Événement réinjecté dans le pipeline.");
        fetchEvents();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Échec de la réinjection";
        toast.error(message);
      } finally {
        setReplaying(false);
      }
    },
    [fetchEvents],
  );

  return {
    events,
    pagination,
    filters,
    selectedEventId,
    isLoading,
    detail,
    isDetailLoading,
    isReplaying,
    selectEvent,
    replay,
    refetch: fetchEvents,
  };
}
