import type { Express } from "express";
import { storage } from "./storage";
import { requireAdmin, hashPin, isValidPin, invalidateUserCache } from "./auth";

const ROLES = ["admin", "supervisor", "operario"] as const;

function publicUser(u: any) {
  // Nunca devolver pinHash.
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    supervisorId: u.supervisorId,
    active: u.active,
    lastLoginAt: u.lastLoginAt,
    lockedUntil: u.lockedUntil,
  };
}

export function registerUserRoutes(app: Express) {
  app.get("/api/users", requireAdmin, async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users.map(publicUser));
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim().toLowerCase();
      const displayName = String(req.body?.displayName || "").trim();
      const pin = String(req.body?.pin || "");
      const role = String(req.body?.role || "operario");
      const supervisorId = req.body?.supervisorId ?? null;

      if (!/^[a-z0-9._-]{2,30}$/.test(username)) {
        return res.status(400).json({
          message: "Usuario inválido: 2 a 30 caracteres, sin espacios ni acentos",
        });
      }
      if (!displayName) {
        return res.status(400).json({ message: "Falta el nombre" });
      }
      if (!isValidPin(pin)) {
        return res.status(400).json({ message: "El PIN debe tener 4 a 6 dígitos" });
      }
      if (!ROLES.includes(role as any)) {
        return res.status(400).json({ message: "Rol inválido" });
      }
      if (await storage.getUserByUsername(username)) {
        return res.status(409).json({ message: "Ese usuario ya existe" });
      }

      const created = await storage.createUser({
        username,
        displayName,
        pinHash: await hashPin(pin),
        role,
        supervisorId: supervisorId ? Number(supervisorId) : null,
        active: true,
      } as any);

      res.status(201).json(publicUser(created));
    } catch (e: any) {
      console.error("create user error:", e);
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID inválido" });

      const target = await storage.getUserById(id);
      if (!target) return res.status(404).json({ message: "Usuario no encontrado" });

      const updates: any = {};

      if (req.body?.displayName !== undefined) {
        const dn = String(req.body.displayName).trim();
        if (!dn) return res.status(400).json({ message: "El nombre no puede quedar vacío" });
        updates.displayName = dn;
      }

      if (req.body?.role !== undefined) {
        if (!ROLES.includes(req.body.role)) {
          return res.status(400).json({ message: "Rol inválido" });
        }
        // No permitir quedarse sin ningun admin activo.
        if (target.role === "admin" && req.body.role !== "admin") {
          const all = await storage.getUsers();
          const admins = all.filter((u) => u.role === "admin" && u.active && u.id !== id);
          if (admins.length === 0) {
            return res.status(400).json({
              message: "No podés quitar el último administrador",
            });
          }
        }
        updates.role = req.body.role;
      }

      if (req.body?.supervisorId !== undefined) {
        const sid = req.body.supervisorId ? Number(req.body.supervisorId) : null;
        if (sid === id) {
          return res.status(400).json({ message: "Un usuario no puede supervisarse a sí mismo" });
        }
        updates.supervisorId = sid;
      }

      if (req.body?.active !== undefined) {
        const active = Boolean(req.body.active);
        if (!active && target.role === "admin") {
          const all = await storage.getUsers();
          const admins = all.filter((u) => u.role === "admin" && u.active && u.id !== id);
          if (admins.length === 0) {
            return res.status(400).json({
              message: "No podés desactivar el último administrador",
            });
          }
        }
        updates.active = active;
      }

      // Reset de PIN por parte del admin (no pide el anterior)
      if (req.body?.pin !== undefined) {
        if (!isValidPin(String(req.body.pin))) {
          return res.status(400).json({ message: "El PIN debe tener 4 a 6 dígitos" });
        }
        updates.pinHash = await hashPin(String(req.body.pin));
        // Un reset de PIN tambien destraba la cuenta
        updates.failedAttempts = 0;
        updates.lockedUntil = null;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "Nada para actualizar" });
      }

      const updated = await storage.updateUser(id, updates);
      // El estado cacheado de este usuario quedo viejo (rol/active pudieron
      // cambiar): invalidarlo para que el cambio pegue enseguida.
      invalidateUserCache(id);
      res.json(publicUser(updated));
    } catch (e: any) {
      console.error("update user error:", e);
      res.status(400).json({ message: e.message });
    }
  });
}
