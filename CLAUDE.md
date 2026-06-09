# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Express + Vite HMR) on port 5000
npm run build        # Production build: Vite for client → dist/public, esbuild for server → dist/index.cjs
npm run start        # Run production build
npm run check        # TypeScript type check (tsc --noEmit)
npm run db:push      # Push Drizzle schema changes to the PostgreSQL database
```

There are no automated tests in this project.

## Architecture

**Focus Task Agenda** is a single-user Kanban task manager. The UI is in Spanish (Argentine Spanish), the design is brutalist (sharp corners, JetBrains Mono + Inter fonts), and the entire stack is TypeScript.

### Monorepo layout

- `client/src/` — React frontend (Vite)
- `server/` — Express backend (transpiled by `tsx` in dev, `esbuild` in prod)
- `shared/` — Schema definitions and TypeScript types shared by both sides
- `script/build.ts` — Custom production build script

### Path aliases

| Alias | Resolves to |
|---|---|
| `@/*` | `client/src/*` |
| `@shared/*` | `shared/*` |

### Data model (`shared/schema.ts`)

Two tables:
- **tasks** — `id`, `text`, `date` (`"dd/MM/yy"` or `"a definir"`), `person`, `type` (`accion | para_pensar | a_definir`), `urgent` (boolean), `status` (`activa | completada | eliminada`). Deletions and completions are soft — they update `status`.
- **logs** — Full audit trail. Every mutation writes a log entry with `source` (`UI | Chat | Audio | Import`), `originalValues`, and `newValues` as JSON strings.

### Kanban column assignment logic (`client/src/components/kanban-board.tsx:22-28`)

| Column | Filter condition |
|---|---|
| URGENTE | `urgent === true` |
| ACCION | `!urgent && (type === 'accion' \|\| type === 'a_definir')` |
| PENSAR | `!urgent && type === 'para_pensar'` |

Tasks within a column are sorted by date (ascending), then by person (`"a definir"` first, then `Mariano`/`Aldana`, then others), then by id.

### Frontend state management

`TaskProvider` (`client/src/lib/task-context.tsx`) wraps the whole app and exposes:
- `state.tasks` / `state.allTasks` / `state.logs` — TanStack React Query queries that poll every 5–10 seconds
- `dispatch(action)` — Translates action objects into API mutations, then invalidates all query caches on success

All components consume state via `useTasks()`. Do not bypass `dispatch`; go through it so logging and cache invalidation stay consistent.

### Backend

`server/routes.ts` registers all routes on the Express app. The storage layer (`server/storage.ts`) is the `DatabaseStorage` class implementing `IStorage` — all DB access goes through it, never raw SQL in routes.

Key non-obvious endpoints:
- `POST /api/tasks/move-expired` — Moves tasks with past dates (and `"a definir"` tasks) to today's date
- `POST /api/parse` — Sends raw Spanish text to OpenAI `gpt-4o-mini` and returns structured `{ actions, summary }`. The AI prompt is inlined in `routes.ts:236`.

### Dev server

In development, Vite runs as Express middleware (`server/vite.ts`), so a single process on port 5000 serves both the API and the HMR-enabled client. In production, static files are served from `dist/public/`.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `OPENAI_API_KEY` | Required for the `/api/parse` AI endpoint |
| `NODE_ENV` | `development` enables Vite middleware; `production` serves static files |
