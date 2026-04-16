import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import { storeTokens, clearTokens } from "@/lib/electron";
import { disconnectSocket } from "@/lib/socket";
import type { LoginResponse } from "@insurance/shared";
import { toast } from "sonner";

export function useAuth() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const data = await api.post<LoginResponse>("auth/login", {
          email,
          password,
        });
        setAuth(data);
        await storeTokens({
          access: data.access_token,
          refresh: data.refresh_token,
        });
        navigate("/", { replace: true });
      } catch (err: any) {
        const message =
          err?.response
            ? (await err.response.json().catch(() => null))?.error?.message
            : null;
        toast.error(message || "Identifiants incorrects");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [setAuth, navigate],
  );

  const logout = useCallback(async () => {
    try {
      const { refreshToken } = useAuthStore.getState();
      await api.post("auth/logout", { refresh_token: refreshToken });
    } catch {
      // Ignore logout API errors
    }
    disconnectSocket();
    clearAuth();
    await clearTokens();
    navigate("/login", { replace: true });
  }, [clearAuth, navigate]);

  return {
    user,
    isAuthenticated,
    isLoading: isLoading || authLoading,
    login,
    logout,
  };
}
