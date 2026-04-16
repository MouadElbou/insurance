import type { PrismaClient } from "@prisma/client";
import type { LoginResponse, RefreshResponse } from "@insurance/shared";
import crypto from "node:crypto";
import { verifyPassword } from "../../utils/password.js";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  compareRefreshToken,
  parseDurationMs,
} from "../../utils/token.js";
import { config } from "../../config.js";

export async function login(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<LoginResponse> {
  const employee = await prisma.employee.findUnique({
    where: { email },
  });

  if (!employee) {
    throw Object.assign(new Error("Email ou mot de passe incorrect."), {
      statusCode: 401,
      code: "AUTH_INVALID_CREDENTIALS",
    });
  }

  if (!employee.is_active) {
    throw Object.assign(new Error("Ce compte est desactive."), {
      statusCode: 401,
      code: "AUTH_ACCOUNT_DISABLED",
    });
  }

  const passwordValid = await verifyPassword(password, employee.password_hash);
  if (!passwordValid) {
    throw Object.assign(new Error("Email ou mot de passe incorrect."), {
      statusCode: 401,
      code: "AUTH_INVALID_CREDENTIALS",
    });
  }

  // Generate tokens
  const accessToken = signAccessToken({
    sub: employee.id,
    email: employee.email,
    role: employee.role,
  });

  const jti = crypto.randomUUID();
  const rawRefreshToken = generateRefreshToken();
  const refreshHash = await hashRefreshToken(rawRefreshToken);

  const expiresMs = parseDurationMs(config.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + expiresMs);

  await prisma.refreshToken.create({
    data: {
      jti,
      token_hash: refreshHash,
      expires_at: expiresAt,
      employee_id: employee.id,
    },
  });

  // Encode jti into the refresh token so we can do O(1) lookup on refresh
  const refreshTokenWithJti = `${jti}:${rawRefreshToken}`;

  return {
    user: {
      id: employee.id,
      email: employee.email,
      full_name: employee.full_name,
      role: employee.role,
      operator_code: employee.operator_code,
    },
    access_token: accessToken,
    refresh_token: refreshTokenWithJti,
  };
}

/**
 * Parse a "jti:rawToken" string. Returns null if malformed.
 */
function parseRefreshToken(token: string): { jti: string; raw: string } | null {
  const colonIdx = token.indexOf(":");
  if (colonIdx === -1) return null;
  const jti = token.substring(0, colonIdx);
  const raw = token.substring(colonIdx + 1);
  if (!jti || !raw) return null;
  return { jti, raw };
}

export async function refresh(
  prisma: PrismaClient,
  refreshToken: string,
): Promise<RefreshResponse> {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) {
    throw Object.assign(
      new Error("Token de rafraichissement invalide ou expire."),
      { statusCode: 401, code: "AUTH_REFRESH_INVALID" },
    );
  }

  // O(1) lookup by jti
  const storedToken = await prisma.refreshToken.findUnique({
    where: { jti: parsed.jti },
    include: { employee: true },
  });

  if (!storedToken || storedToken.is_revoked || storedToken.expires_at <= new Date()) {
    throw Object.assign(
      new Error("Token de rafraichissement invalide ou expire."),
      { statusCode: 401, code: "AUTH_REFRESH_INVALID" },
    );
  }

  // Single bcrypt compare against the matched token
  const isMatch = await compareRefreshToken(parsed.raw, storedToken.token_hash);
  if (!isMatch) {
    throw Object.assign(
      new Error("Token de rafraichissement invalide ou expire."),
      { statusCode: 401, code: "AUTH_REFRESH_INVALID" },
    );
  }

  if (!storedToken.employee.is_active) {
    // Revoke the token if the account is disabled
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { is_revoked: true },
    });
    throw Object.assign(new Error("Ce compte est desactive."), {
      statusCode: 401,
      code: "AUTH_ACCOUNT_DISABLED",
    });
  }

  // Revoke the old token (token rotation)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { is_revoked: true },
  });

  // Issue new token pair
  const accessToken = signAccessToken({
    sub: storedToken.employee.id,
    email: storedToken.employee.email,
    role: storedToken.employee.role,
  });

  const newJti = crypto.randomUUID();
  const newRawRefreshToken = generateRefreshToken();
  const newRefreshHash = await hashRefreshToken(newRawRefreshToken);

  const expiresMs = parseDurationMs(config.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + expiresMs);

  await prisma.refreshToken.create({
    data: {
      jti: newJti,
      token_hash: newRefreshHash,
      expires_at: expiresAt,
      employee_id: storedToken.employee.id,
    },
  });

  return {
    access_token: accessToken,
    refresh_token: `${newJti}:${newRawRefreshToken}`,
  };
}

export async function logout(
  prisma: PrismaClient,
  refreshToken: string,
): Promise<void> {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return; // Malformed token, idempotent logout

  const storedToken = await prisma.refreshToken.findUnique({
    where: { jti: parsed.jti },
  });

  if (!storedToken || storedToken.is_revoked) return; // Already revoked or not found

  const isMatch = await compareRefreshToken(parsed.raw, storedToken.token_hash);
  if (!isMatch) return; // Token mismatch, idempotent logout

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { is_revoked: true },
  });
}

export async function getMe(
  prisma: PrismaClient,
  userId: string,
): Promise<{ id: string; email: string; full_name: string; role: string; operator_code: string }> {
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      full_name: true,
      role: true,
      operator_code: true,
    },
  });

  if (!employee) {
    throw Object.assign(new Error("Utilisateur introuvable."), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  return employee;
}

export async function cleanExpiredTokens(
  prisma: PrismaClient,
): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expires_at: { lt: new Date() } },
        { is_revoked: true },
      ],
    },
  });
  return result.count;
}
