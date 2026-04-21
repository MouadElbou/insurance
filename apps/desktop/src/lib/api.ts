import ky, { type Options } from "ky";
import type {
  ApiResponse,
  InsurerDomain,
  InsurerDomainInput,
  PaginatedResponse,
  ScraperBatchRequest,
  ScraperBatchResponse,
  ScraperEventDetail,
  ScraperEventListItem,
  ScraperEventStats,
  ScraperEventsQuery,
} from "@insurance/shared";
import { useAuthStore } from "@/stores/auth.store";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

const client = ky.create({
  prefixUrl: `${API_BASE}/api/v1`,
  timeout: 30000,
  hooks: {
    beforeRequest: [
      (request) => {
        const { accessToken } = useAuthStore.getState();
        if (accessToken) {
          request.headers.set("Authorization", `Bearer ${accessToken}`);
        }
      },
    ],
    afterResponse: [
      async (request, _options, response) => {
        if (response.status === 401) {
          const { refreshToken, updateTokens, clearAuth } =
            useAuthStore.getState();

          if (!refreshToken) {
            clearAuth();
            window.location.href = "/login";
            throw new Error("No refresh token available");
          }

          try {
            const refreshResponse = await ky
              .post(`${API_BASE}/api/v1/auth/refresh`, {
                json: { refresh_token: refreshToken },
              })
              .json<
                ApiResponse<{ access_token: string; refresh_token: string }>
              >();

            if (refreshResponse.success) {
              updateTokens(
                refreshResponse.data.access_token,
                refreshResponse.data.refresh_token,
              );

              // Retry original request with new token
              request.headers.set(
                "Authorization",
                `Bearer ${refreshResponse.data.access_token}`,
              );
              return ky(request);
            }
          } catch {
            clearAuth();
            window.location.href = "/login";
            throw new Error("Token refresh failed");
          }
        }
        return response;
      },
    ],
  },
});

async function unwrap<T>(
  promise: Promise<Response>,
): Promise<T> {
  const response = await promise;
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }
  const body = (await response.json()) as ApiResponse<T>;
  return body.data;
}

/** Raw ky client — use for non-JSON responses (blob downloads, etc.) */
export const rawClient = client;

export const api = {
  get<T>(url: string, options?: Options): Promise<T> {
    return unwrap<T>(client.get(url, options));
  },

  post<T>(url: string, json?: unknown, options?: Options): Promise<T> {
    return unwrap<T>(client.post(url, { ...options, json }));
  },

  patch<T>(url: string, json?: unknown, options?: Options): Promise<T> {
    return unwrap<T>(client.patch(url, { ...options, json }));
  },

  put<T>(url: string, json?: unknown, options?: Options): Promise<T> {
    return unwrap<T>(client.put(url, { ...options, json }));
  },

  delete<T>(url: string, options?: Options): Promise<T> {
    return unwrap<T>(client.delete(url, options));
  },

  // For file uploads — returns raw response
  upload<T>(url: string, body: FormData, options?: Options): Promise<T> {
    return unwrap<T>(client.post(url, { ...options, body }));
  },
};

function toSearchParams(
  query: Record<string, unknown>,
): URLSearchParams | undefined {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? params : undefined;
}

/**
 * Scraper ingestion API client.
 * Backend endpoints defined in the scraper-architect architecture spec.
 */
export const scraperApi = {
  // --------------------------------------------------------------- //
  // Event ingestion — called from the main->renderer IPC reply flow
  // --------------------------------------------------------------- //
  submitBatch(batch: ScraperBatchRequest): Promise<ScraperBatchResponse> {
    return api.post<ScraperBatchResponse>("scraper/events", batch);
  },

  // --------------------------------------------------------------- //
  // Event reporting (MANAGER)
  // --------------------------------------------------------------- //
  listEvents(
    query: ScraperEventsQuery = {},
  ): Promise<PaginatedResponse<ScraperEventListItem>> {
    const searchParams = toSearchParams(query as Record<string, unknown>);
    return api.get<PaginatedResponse<ScraperEventListItem>>("scraper/events", {
      searchParams,
    });
  },

  getEvent(id: string): Promise<ScraperEventDetail> {
    return api.get<ScraperEventDetail>(`scraper/events/${id}`);
  },

  replayEvent(id: string): Promise<ScraperEventDetail> {
    return api.post<ScraperEventDetail>(`scraper/events/${id}/replay`);
  },

  stats(employeeId?: string): Promise<ScraperEventStats> {
    const searchParams = employeeId
      ? toSearchParams({ employee_id: employeeId })
      : undefined;
    return api.get<ScraperEventStats>("scraper/events/stats", {
      searchParams,
    });
  },

  // --------------------------------------------------------------- //
  // Insurer domain allowlist (MANAGER)
  // --------------------------------------------------------------- //
  listDomains(): Promise<InsurerDomain[]> {
    return api.get<InsurerDomain[]>("scraper/insurer-domains");
  },

  createDomain(input: InsurerDomainInput): Promise<InsurerDomain> {
    return api.post<InsurerDomain>("scraper/insurer-domains", input);
  },

  updateDomain(
    id: string,
    input: InsurerDomainInput,
  ): Promise<InsurerDomain> {
    return api.put<InsurerDomain>(`scraper/insurer-domains/${id}`, input);
  },

  deleteDomain(id: string): Promise<void> {
    return api.delete<void>(`scraper/insurer-domains/${id}`);
  },
};
