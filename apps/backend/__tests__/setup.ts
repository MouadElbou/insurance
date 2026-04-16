/**
 * Vitest setup for backend tests.
 * Sets env vars BEFORE any module imports so that config.ts validation passes.
 */

// Must set env vars before config.ts is ever imported (it validates at module load)
process.env.NODE_ENV = "test";
process.env.PORT = "3001";
process.env.HOST = "0.0.0.0";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test_db";
process.env.JWT_SECRET = "test-jwt-secret-must-be-at-least-32-chars-long";
process.env.JWT_REFRESH_SECRET = "test-jwt-refresh-secret-must-be-at-least-32-chars-long";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.BCRYPT_ROUNDS = "4"; // Fast rounds for testing
process.env.CORS_ORIGIN = "*";
