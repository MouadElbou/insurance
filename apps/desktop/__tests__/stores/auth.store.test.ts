import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../../src/stores/auth.store";
import type { LoginResponse } from "@insurance/shared";

function resetStore() {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });
}

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  full_name: "Test User",
  role: "MANAGER" as const,
  operator_code: "int00001",
};

const mockLoginResponse: LoginResponse = {
  user: mockUser,
  access_token: "access-token-123",
  refresh_token: "refresh-token-456",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("initial state", () => {
    it("should have null user, tokens, and isAuthenticated false", () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it("should start with isLoading true", () => {
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(true);
    });
  });

  describe("setAuth", () => {
    it("should set user, tokens, and mark as authenticated", () => {
      useAuthStore.getState().setAuth(mockLoginResponse);
      const state = useAuthStore.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe("access-token-123");
      expect(state.refreshToken).toBe("refresh-token-456");
      expect(state.isAuthenticated).toBe(true);
    });

    it("should set isLoading to false", () => {
      useAuthStore.getState().setAuth(mockLoginResponse);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("should overwrite previous auth data on re-login", () => {
      useAuthStore.getState().setAuth(mockLoginResponse);
      const secondLogin: LoginResponse = {
        user: { ...mockUser, id: "user-2", email: "other@example.com" },
        access_token: "new-access",
        refresh_token: "new-refresh",
      };
      useAuthStore.getState().setAuth(secondLogin);
      const state = useAuthStore.getState();
      expect(state.user?.id).toBe("user-2");
      expect(state.accessToken).toBe("new-access");
    });
  });

  describe("clearAuth", () => {
    it("should reset all auth state", () => {
      useAuthStore.getState().setAuth(mockLoginResponse);
      useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it("should set isLoading to false", () => {
      useAuthStore.getState().clearAuth();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("should be safe to call when already cleared", () => {
      useAuthStore.getState().clearAuth();
      useAuthStore.getState().clearAuth();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("updateTokens", () => {
    it("should update access and refresh tokens", () => {
      useAuthStore.getState().setAuth(mockLoginResponse);
      useAuthStore.getState().updateTokens("new-access", "new-refresh");
      const state = useAuthStore.getState();

      expect(state.accessToken).toBe("new-access");
      expect(state.refreshToken).toBe("new-refresh");
    });

    it("should not change user or isAuthenticated", () => {
      useAuthStore.getState().setAuth(mockLoginResponse);
      useAuthStore.getState().updateTokens("new-access", "new-refresh");
      const state = useAuthStore.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });

    it("should work even when called before setAuth", () => {
      useAuthStore.getState().updateTokens("orphan-access", "orphan-refresh");
      const state = useAuthStore.getState();
      expect(state.accessToken).toBe("orphan-access");
      expect(state.refreshToken).toBe("orphan-refresh");
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("setUser", () => {
    it("should update only the user", () => {
      useAuthStore.getState().setAuth(mockLoginResponse);
      const updatedUser = { ...mockUser, full_name: "Updated Name" };
      useAuthStore.getState().setUser(updatedUser);

      const state = useAuthStore.getState();
      expect(state.user?.full_name).toBe("Updated Name");
      expect(state.accessToken).toBe("access-token-123");
    });

    it("should preserve other state fields", () => {
      useAuthStore.getState().setAuth(mockLoginResponse);
      useAuthStore.getState().setUser({ ...mockUser, role: "EMPLOYEE" });
      const state = useAuthStore.getState();

      expect(state.user?.role).toBe("EMPLOYEE");
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("setLoading", () => {
    it("should set isLoading to true", () => {
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it("should set isLoading to false", () => {
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("should not affect other state", () => {
      useAuthStore.getState().setAuth(mockLoginResponse);
      useAuthStore.getState().setLoading(true);
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
    });
  });
});
