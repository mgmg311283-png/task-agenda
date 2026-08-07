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

// ── Estado del usuario, con cache corta ──────────────────────────────────
// Hay que revalidar en CADA request que el usuario siga activo: si solo se
// chequeara al login, alguien desactivado seguiria entrando con su cookie
// (que dura 90 dias). La cache de 60s evita un SELECT por request sin que
// una desactivacion tarde en surtir efecto.
export interface LiveUser {
  id: number;
  role: UserRole;
  active: boolean;
}

type UserLoader = (id: number) => Promise<LiveUser | undefined>;

let userLoader: UserLoader | null = null;
const userCache = new Map<number, { user: LiveUser | undefined; at: number }>();
const USER_TTL_MS = 60_000;

/** Inyectado desde index.ts para no crear un ciclo auth <-> storage. */
export function setUserLoader(loader: UserLoader): void {
  userLoader = loader;
}

export function invalidateUserCache(id?: number): void {
  if (id === undefined) userCache.clear();
  else userCache.delete(id);
}

async function loadUser(id: number): Promise<LiveUser | undefined> {
  const hit = userCache.get(id);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.user;
  if (!userLoader) return undefined;
  const user = await userLoader(id);
  userCache.set(id, { user, at: Date.now() });
  return user;
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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.userId) {
    const user = await loadUser(req.session.userId);
    if (!user || !user.active) {
      return req.session.destroy(() =>
        res.status(401).json({ message: "No autenticado" }),
      );
    }
    // El rol pudo cambiar despues de que se creo la sesion.
    if (user.role !== req.session.role) {
      req.session.role = user.role;
    }
    return next();
  }
  if (!AUTH_ENFORCED) return next();
  return res.status(401).json({ message: "No autenticado" });
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_ENFORCED && !req.session?.userId) return next();
  if (!req.session?.userId) {
    return res.status(401).json({ message: "No autenticado" });
  }
  const user = await loadUser(req.session.userId);
  if (!user || !user.active) {
    return req.session.destroy(() =>
      res.status(401).json({ message: "No autenticado" }),
    );
  }
  if (user.role !== "admin") {
    return res.status(403).json({ message: "Requiere permisos de administrador" });
  }
  req.session.role = user.role;
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
