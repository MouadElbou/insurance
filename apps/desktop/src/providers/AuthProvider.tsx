import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { getTokens, storeTokens, clearTokens } from "@/lib/electron";
import { api } from "@/lib/api";
import type { RefreshResponse } from "@insurance/shared";
import { Loader2 } from "lucide-react";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { isLoading, setAuth, updateTokens, setLoading, clearAuth } =
    useAuthStore();

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const tokens = await getTokens();
        if (!tokens || !tokens.access || !tokens.refresh) {
          if (mounted) setLoading(false);
          return;
        }

        // Set tokens temporarily to allow API calls
        updateTokens(tokens.access, tokens.refresh);

        // Validate by refreshing
        try {
          const refreshed = await api.post<RefreshResponse>("auth/refresh", {
            refresh_token: tokens.refresh,
          });

          if (!mounted) return;

          // Get user profile with new tokens
          updateTokens(refreshed.access_token, refreshed.refresh_token);
          await storeTokens({
            access: refreshed.access_token,
            refresh: refreshed.refresh_token,
          });

          // Fetch user profile
          const user = await api.get<{
            id: string;
            email: string;
            full_name: string;
            role: "MANAGER" | "EMPLOYEE";
            operator_code: string;
          }>("auth/me");

          if (!mounted) return;

          setAuth({
            user,
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token,
          });
        } catch {
          // Token expired or invalid
          if (mounted) {
            clearAuth();
            await clearTokens();
          }
        }
      } catch {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground tracking-wide">
            Chargement...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
