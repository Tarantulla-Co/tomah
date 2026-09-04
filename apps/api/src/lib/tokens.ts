import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { prisma, type UserRole } from "@tomah/db";
import { env } from "../config/env.js";

export interface AccessTokenClaims {
  sub: string; // user id
  role: UserRole;
  name: string;
  email: string;
}

/* ----------------------------- access tokens ------------------------------ */

export function signAccessToken(claims: AccessTokenClaims): string {
  const opts: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
    issuer: "tomah-admin",
  };
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: "tomah-admin" }) as AccessTokenClaims;
}

/* ----------------------------- refresh tokens ---------------------------- */
// Opaque random string given to the client (httpOnly cookie); only its SHA-256
// hash is stored. Rotated on every use; the previous row is revoked.

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function issueRefreshToken(
  userId: string,
  meta: { userAgent?: string; ipAddress?: string },
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255),
      ipAddress: meta.ipAddress,
    },
  });

  return { token, expiresAt };
}

/** Validate a presented refresh token. Returns the owning userId or null. */
export async function consumeRefreshToken(token: string): Promise<string | null> {
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.revokedAt || row.expiresAt < new Date()) return null;
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  return row.userId;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
