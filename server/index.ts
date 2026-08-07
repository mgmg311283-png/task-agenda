import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { registerAuthRoutes, seedAdmin } from "./auth-routes";
import { registerUserRoutes } from "./user-routes";
import { setUserLoader } from "./auth";
import { pool, storage } from "./storage";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// Detras de nginx. Sin esto express-session no ve X-Forwarded-Proto y se
// niega a mandar la cookie `secure`.
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// CORS con allowlist. Antes reflejaba CUALQUIER Origin con credentials:true.
// Sin cookies eso era feo pero inocuo; con sesiones seria un agujero real
// (cualquier web que el usuario visite podria hacer requests autenticados
// contra esta API y leer las respuestas).
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "https://tareas.206-81-13-53.sslip.io")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(compression());
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ── Sesiones ────────────────────────────────────────────────────────────
const PgSession = connectPgSimple(session);
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.error("FATAL: falta SESSION_SECRET");
  process.exit(1);
}

app.use(
  session({
    name: "tareas.sid",
    store: new PgSession({ pool, tableName: "session" }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // En produccion siempre hay TLS por delante (nginx). En dev local no.
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      // 90 dias: es deliberado. Son operarios en el celular; si tienen que
      // re-loguearse seguido, dejan de usar la app.
      maxAge: 90 * 24 * 60 * 60 * 1000,
    },
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // No loguear cuerpos de auth: llevan PINs.
      if (capturedJsonResponse && !path.startsWith("/api/auth")) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Inyectado para que auth.ts pueda revalidar el usuario sin importar
  // storage (evita el ciclo auth <-> storage).
  setUserLoader(async (id) => {
    const u = await storage.getUserById(id);
    return u ? { id: u.id, role: u.role as any, active: u.active } : undefined;
  });

  registerAuthRoutes(app);
  registerUserRoutes(app);
  await registerRoutes(httpServer, app);
  await seedAdmin();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
