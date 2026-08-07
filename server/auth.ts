import type { Request, Response, NextFunction } from "express";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

// ── Roles y scope ────────────────────────────────────────────────────────
export type UserRole = "admin" | "supervisor" | "operario";

export interface Scope {
  userId: number;
  role: UserRole;
  /** ids de los usuarios que reportan a este supervisor (vacio para otros roles) */
  teamIds: number[];
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: UserRole;
    teamIds?: number[];
  }
}

// Interruptor de corte. Con el flag apagado la app se comporta EXACTAMENTE
// como antes de existir el login (todo abierto, todo admin). Permite deployar
// el codigo, verificar que no rompio nada, crear los usuarios y recien ahi
// prender la autenticacion — y volver atras en segundos sin re-deployar.
const AUTH_ENFORCED = process.env.AUTH_ENFORCED === "true";
const LEGACY_ADMIN_ID = Number(process.env.LEGACY_ADMIN_ID || 1);

export function isAuthEnforced(): boolean {
  return AUTH_ENFORCED;
}

export function getScope(req: Request): Scope {
  if (req.session?.userId) {
    return {
      userId: req.session.userId,
      role: (req.session.role || "operario") as UserRole,
      teamIds: req.session.teamIds || [],
    };
  }
  // Modo transicion: sin sesion y sin enforcement => admin legado.
  return { userId: LEGACY_ADMIN_ID, role: "admin", teamIds: [] };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) return next();
  if (!AUTH_ENFORCED) return next();
  return res.status(401).json({ message: "No autenticado" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_ENFORCED && !req.session?.userId) return next();
  if (!req.session?.userId) {
    return res.status(401).json({ message: "No autenticado" });
  }
  if (req.session.role !== "admin") {
    return res.status(403).json({ message: "Requiere permisos de administrador" });
  }
  next();
}

// ── Hash del PIN ─────────────────────────────────────────────────────────
// scrypt de node:crypto: cero dependencias nuevas, asi no hay que tocar
// package-lock.json (auto-deploy corre `npm ci`, que aborta si el lock quedo
// desincronizado).
//
// Nota honesta: un PIN de 4 digitos son 10.000 combinaciones. Contra un dump
// robado de la base ningun algoritmo de hash lo salva. Las defensas reales
// son el lockout por intentos fallidos, el rate limit del login, y que la
// base no sea accesible desde internet.
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await scrypt(pin, salt, 64);
  return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const dk = await scrypt(pin, salt, 64);
    if (dk.length !== expected.length) return false;
    return timingSafeEqual(dk, expected);
  } catch {
    return false;
  }
}

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === "string" && /^\d{4,6}$/.test(pin);
}

// ── Lockout ──────────────────────────────────────────────────────────────
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
