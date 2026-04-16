import { create } from "zustand";
import type { LoginResponse, Role } from "@insurance/shared";

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  operator_code: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (data: LoginResponse) => void;
  updateTokens: (access: string, refresh: string) => void;
  setUser: (user: AuthUser) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (data: LoginResponse) =>
    set({
      user: data.user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
      isLoading: false,
    }),

  updateTokens: (access: string, refresh: string) =>
    set({
      accessToken: access,
      refreshToken: refresh,
    }),

  setUser: (user: AuthUser) => set({ user }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}));
