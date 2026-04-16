# ADR 002: Authentication with JWT + Refresh Token Rotation

**Date**: 2026-04-15
**Status**: Accepted

## Context

The application requires authentication for a small user base (~30 employees + 1 manager). The desktop client (Electron) connects to a remote backend over HTTPS. We need:
- Stateless request authentication (no server-side session store)
- Secure token storage on the client
- Automatic session renewal without forcing re-login
- Token revocation capability (for logout and compromised accounts)

Alternatives considered:
1. **Session cookies**: Would require server-side session storage and cross-origin cookie handling for Electron. Electron apps using custom protocols (`app://`) do not handle cookies the same way as browsers.
2. **OAuth 2.0**: Overkill for a single-tenant application with one identity provider (the backend itself).
3. **JWT-only (no refresh)**: Would require either very long token lifetimes (insecure) or frequent re-login (poor UX).

## Decision

Use **JWT access tokens** (15-minute expiry) paired with **opaque refresh tokens** (7-day expiry) with **rotation**.

### Flow

1. User logs in with email/password. Backend returns an access token (JWT) and a refresh token (random UUID).
2. The refresh token is bcrypt-hashed and stored in the `RefreshToken` database table.
3. The Electron client stores both tokens using `safeStorage` (OS-level encryption) via the preload bridge.
4. API requests include the access token as `Authorization: Bearer <token>`.
5. When a request returns 401 (expired access token), the API client (`ky`) automatically calls `/auth/refresh` with the refresh token.
6. The backend verifies the refresh token hash, revokes the old token, and issues a new pair (rotation).
7. If the refresh token is expired or revoked, the user is redirected to login.
8. On logout, the refresh token is revoked in the database.

### Why rotation

Refresh token rotation means that each refresh token can only be used once. If an attacker steals a refresh token and the legitimate user also uses it, one of them will receive a "revoked" error, which signals a compromise. Without rotation, a stolen refresh token could be used indefinitely until it expires.

### Why opaque refresh tokens (not JWT)

Refresh tokens are stored as bcrypt hashes in the database. Using opaque UUIDs rather than JWTs for refresh tokens means:
- Revocation is immediate (check database, not waiting for JWT expiry).
- No risk of the refresh token being decoded client-side to extract claims.
- The token itself carries no information -- security through simplicity.

### Token storage on Electron

Electron's `safeStorage.encryptString()` uses the OS credential store (DPAPI on Windows). Tokens are encrypted at rest in an electron-store JSON file. The renderer process cannot access them directly -- all token operations go through the preload IPC bridge.

## Consequences

- **Positive**: Short-lived access tokens (15min) limit the damage window if one is intercepted.
- **Positive**: Refresh rotation detects token theft.
- **Positive**: `safeStorage` encrypts tokens at rest, preventing extraction from the filesystem.
- **Positive**: Stateless access token verification (JWT signature check) means no database query per API request.
- **Negative**: Requires a database query per refresh operation (lookup + revoke + create). Acceptable at 30 users.
- **Negative**: The refresh flow adds complexity to the API client. Implemented once in the `ky` beforeError hook.
- **Negative**: If both access and refresh tokens are stolen simultaneously, the attacker has a 7-day window. Mitigated by HTTPS-only deployment and encrypted storage.
