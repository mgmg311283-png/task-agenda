import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";
import {
  hashPin, verifyPin, isValidPin, requireAuth, getScope,
  MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES, type UserRole,
} from "./auth";

// Rate limit por IP para frenar el brute force online. Es la defensa real
// de un PIN corto, junto con el lockout por usuario.
const loginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Demasiados intentos. Esperá un minuto." },
});

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim();
      const pin = String(req.body?.pin || "");
      // Mensaje generico a proposito: no revelar si el usuario existe.
      const GENERIC = "Usuario o PIN incorrecto";

      if (!username || !pin) {
        return res.status(400).json({ message: GENERIC });
      }

      const user = await storage.getUserByUsername(username);
      if (!user || !user.active) {
        return res.status(401).json({ message: GENERIC });
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        return res.status(423).json({
          message: `Cuenta bloqueada por intentos fallidos. Reintentá en ${mins} min.`,
        });
      }

      const ok = await verifyPin(pin, user.pinHash);
      if (!ok) {
        const attempts = (user.failedAttempts || 0) + 1;
        const locked = attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60000)
          : null;
        await storage.registerLoginFailure(user.id, locked ? 0 : attempts, locked);
        if (locked) {
          return res.status(423).json({
            message: `Demasiados intentos fallidos. Cuenta bloqueada ${LOCKOUT_MINUTES} min.`,
          });
        }
        return res.status(401).json({ message: GENERIC });
      }

      const teamIds = user.role === "supervisor"
        ? await storage.getTeamIds(user.id)
        : [];

      // regenerate previene session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error("session regenerate error:", err);
          return res.status(500).json({ message: "Error de sesión" });
        }
        req.session.userId = user.id;
        req.session.role = user.role as UserRole;
        req.session.teamIds = teamIds;
        req.session.save(async (err2) => {
          if (err2) {
            console.error("session save error:", err2);
            return res.status(500).json({ message: "Error de sesión" });
          }
          await storage.registerLoginSuccess(user.id);
          res.json({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            role: user.role,
          });
        });
      });
    } catch (e: any) {
      console.error("login error:", e);
      res.status(500).json({ message: "Error al iniciar sesión" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("tareas.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const scope = getScope(req);
    const user = await storage.getUserById(scope.userId);
    if (!user || !user.active) {
      // Usuario borrado o desactivado despues de loguearse: cortar la sesion
      // en vez de dejarlo entrar con una cookie vieja.
      return req.session.destroy(() =>
        res.status(401).json({ message: "No autenticado" }),
      );
    }
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });
  });

  // Cambiar el PIN propio (pide el actual)
  app.post("/api/auth/pin", requireAuth, async (req, res) => {
    try {
      const scope = getScope(req);
      const currentPin = String(req.body?.currentPin || "");
      const newPin = String(req.body?.newPin || "");

      if (!isValidPin(newPin)) {
        return res.status(400).json({ message: "El PIN nuevo debe tener 4 a 6 dígitos" });
      }
      const user = await storage.getUserById(scope.userId);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      if (!(await verifyPin(currentPin, user.pinHash))) {
        return res.status(401).json({ message: "El PIN actual no es correcto" });
      }
      await storage.updateUser(user.id, { pinHash: await hashPin(newPin) });
      res.json({ ok: true });
    } catch (e: any) {
      console.error("change pin error:", e);
      res.status(500).json({ message: "Error al cambiar el PIN" });
    }
  });
}

/**
 * Crea/actualiza el admin inicial desde variables de entorno.
 * Resuelve el arranque en frio (sin usuarios no hay login, sin login no hay
 * pantalla para crear usuarios) y sirve de recuperacion si se pierde el PIN.
 */
export async function seedAdmin(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const pin = process.env.ADMIN_PIN;
  if (!username || !pin) return;
  if (!isValidPin(pin)) {
    console.warn("[seed] ADMIN_PIN debe ser de 4 a 6 dígitos — omitido");
    return;
  }
  try {
    const existing = await storage.getUserByUsername(username);
    const pinHash = await hashPin(pin);
    if (existing) {
      await storage.updateUser(existing.id, {
        pinHash, role: "admin", active: true,
      });
      console.log(`[seed] admin "${username}" actualizado`);
    } else {
      await storage.createUser({
        username,
        displayName: process.env.ADMIN_DISPLAY_NAME || username,
        pinHash,
        role: "admin",
        active: true,
        supervisorId: null,
      } as any);
      console.log(`[seed] admin "${username}" creado`);
    }
  } catch (e) {
    console.error("[seed] error creando admin:", e);
  }
}
