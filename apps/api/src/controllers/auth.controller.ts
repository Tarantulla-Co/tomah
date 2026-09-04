import type { CookieOptions, Request, Response } from "express";
import { prisma } from "@tomah/db";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { verifyPassword } from "../lib/password.js";
import {
  consumeRefreshToken,
  issueRefreshToken,
  revokeAllUserRefreshTokens,
  revokeRefreshToken,
  signAccessToken,
} from "../lib/tokens.js";
import type { LoginInput } from "../validators/auth.schema.js";

function refreshCookieOptions(expiresAt?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    // Omit the Domain attribute entirely when COOKIE_DOMAIN is blank so the
    // cookie is host-only (the correct choice behind a Vercel /api rewrite).
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    path: "/api/v1/auth",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

function publicUser(u: { id: string; email: string; name: string; role: string; lastLoginAt: Date | null }) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, lastLoginAt: u.lastLoginAt };
}

/** POST /api/v1/auth/login */
export async function login(req: Request<unknown, unknown, LoginInput>, res: Response) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  // Constant-ish work whether or not the user exists.
  const ok = user ? await verifyPassword(user.passwordHash, password) : false;
  if (!user || !ok) throw HttpError.unauthorized("Invalid email or password");
  if (!user.isActive) throw HttpError.forbidden("This account has been deactivated");

  const { token, expiresAt } = await issueRefreshToken(user.id, {
    userAgent: req.header("user-agent") ?? undefined,
    ipAddress: req.ip,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  res.cookie(env.REFRESH_COOKIE_NAME, token, refreshCookieOptions(expiresAt));
  res.json({ user: publicUser(user), accessToken });
}

/** POST /api/v1/auth/refresh — rotates the refresh token, returns a new access token. */
export async function refresh(req: Request, res: Response) {
  const presented = req.cookies?.[env.REFRESH_COOKIE_NAME] as string | undefined;
  if (!presented) throw HttpError.unauthorized("No refresh token");

  const userId = await consumeRefreshToken(presented);
  if (!userId) {
    res.clearCookie(env.REFRESH_COOKIE_NAME, refreshCookieOptions());
    throw HttpError.unauthorized("Refresh token is invalid or expired");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    res.clearCookie(env.REFRESH_COOKIE_NAME, refreshCookieOptions());
    throw HttpError.unauthorized("Account is no longer active");
  }

  const { token, expiresAt } = await issueRefreshToken(user.id, {
    userAgent: req.header("user-agent") ?? undefined,
    ipAddress: req.ip,
  });

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  });

  res.cookie(env.REFRESH_COOKIE_NAME, token, refreshCookieOptions(expiresAt));
  res.json({ user: publicUser(user), accessToken });
}

/** POST /api/v1/auth/logout */
export async function logout(req: Request, res: Response) {
  const presented = req.cookies?.[env.REFRESH_COOKIE_NAME] as string | undefined;
  if (presented) await revokeRefreshToken(presented);
  res.clearCookie(env.REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.status(204).send();
}

/** POST /api/v1/auth/logout-all — revoke every session for the current user. */
export async function logoutAll(req: Request, res: Response) {
  if (!req.auth) throw HttpError.unauthorized();
  await revokeAllUserRefreshTokens(req.auth.userId);
  res.clearCookie(env.REFRESH_COOKIE_NAME, refreshCookieOptions());
  res.status(204).send();
}

/** GET /api/v1/auth/me */
export async function me(req: Request, res: Response) {
  if (!req.auth) throw HttpError.unauthorized();
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) throw HttpError.unauthorized();
  res.json({ user: publicUser(user) });
}
