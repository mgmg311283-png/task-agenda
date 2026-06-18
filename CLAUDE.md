# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Express + Vite HMR) on port 5000
npm run build        # Production build: Vite for client → dist/public, esbuild for server → dist/index.cjs
npm run start        # Run production build (includes drizzle-kit push for auto DB migration)
npm run check        # TypeScript type check (tsc --noEmit)
npm run db:push      # Push Drizzle schema changes to the PostgreSQL database
```

There are no automated tests in this project.

## Deployment

Deployed to **Railway** and **Replit**. Environment variables (`DATABASE_URL`, `OPENAI_API_KEY`) are managed per platform.

The `start` script automatically runs `drizzle-kit push` before launching, ensuring schema migrations are applied on deploy.

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
- **tasks** — `id`, `text`, `date` (`"dd/MM/yy"` or `"a definir"`), `person`, `type` (`accion | para_pensar | a_definir`), `urgent` (boolean), `status` (`activa | completada | eliminada`), `starred` (boolean), `priority` (`baja | normal | alta`), `createdAt`, `updatedAt`. Deletions and completions are soft — they update `status`.
- **logs** — Full audit trail. Every mutation writes a log entry with `source` (`UI | Chat | Audio | Import`), `action`, `details`, `originalValues`, and `newValues` as JSON strings.

### Routing

Uses **wouter** (not React Router). Three pages:
- `/` — `Dashboard` (TopBar + KanbanBoard + ChatInterface)
- `/log` — `LogView` (audit log table)
- `/metrics` — `MetricsView` (charts)

### Kanban column assignment logic (`client/src/components/kanban-board.tsx:23-31`)

Column IDs in code are `urgent`, `action`, `think` (titles displayed are URGENTE, ACCION, PENSAR):

| Column ID | Filter condition |
|---|---|
| `urgent` | `urgent === true` |
| `action` | `!urgent && (type === 'accion' \|\| type === 'a_definir')` |
| `think` | `!urgent && type === 'para_pensar'` |

Tasks within a column are sorted by date (ascending, `"a definir"` first), then by person (`"a definir"` → Mariano/Aldana → others), then by id.

Drag-and-drop (via `@dnd-kit/core`) between columns updates `urgent` and `type` automatically — dropping on `urgent` sets `urgent: true`; dropping on `action` sets `urgent: false, type: 'accion'`; dropping on `think` sets `urgent: false, type: 'para_pensar'`.

### Frontend state management

`TaskProvider` (`client/src/lib/task-context.tsx`) wraps the whole app and exposes:
- `state.tasks` / `state.allTasks` / `state.logs` — TanStack React Query queries that poll every 5–10 seconds
- `dispatch(action)` — Translates action objects into API mutations, then invalidates all query caches on success
- `moveExpiredAsync(source)` — Awaitable version of MOVE_EXPIRED for use in `TopBar`

All components consume state via `useTasks()`. Do not bypass `dispatch`; go through it so logging and cache invalidation stay consistent.

### Chat / AI flow (`client/src/components/chat-interface.tsx`)

The chat bar at the bottom of Dashboard accepts typed or voice-dictated Spanish text:
1. Text is sent to `POST /api/parse` with `existingTaskIds` for context.
2. The server calls `gpt-4o-mini` with an inlined Argentine Spanish prompt and returns `{ actions, summary }`.
3. The client loops over `actions` and calls `dispatch` for each (ADD_TASK, COMPLETE_TASK, DELETE_TASK, UPDATE_TASK, MOVE_EXPIRED).
4. Voice input uses the browser's Web Speech API (`SpeechRecognition`). The `"/"` key globally focuses the chat input; `Escape` clears and blurs it.

### CSV import

The Dashboard supports bulk task import from CSV files. Headers are auto-detected; if missing, they are inferred from the first row. Columns map to task fields (`text`, `date`, `person`, `type`, `urgent`, `status`, `starred`).

### Favorites filter

A star icon button in the top right of the search bar allows filtering to show only starred/favorite tasks. When active, the star fills with yellow and only tasks marked as favorites are displayed across all columns.

### Backend

`server/routes.ts` registers all routes on the Express app. The storage layer (`server/storage.ts`) is the `DatabaseStorage` class implementing `IStorage` — all DB access goes through it, never raw SQL in routes.

Key non-obvious endpoints:
- `GET /api/tasks` — Fetch all active (non-deleted, non-completed) tasks
- `GET /api/tasks/all` — Fetch all tasks including completed and deleted (for metrics)
- `GET /api/tasks/next-id` — Get the next available task ID
- `POST /api/tasks` — Create a task
- `PATCH /api/tasks/:id` — Update a task
- `POST /api/tasks/:id/complete` — Complete a task (soft mark)
- `POST /api/tasks/:id/delete` — Delete a task (soft delete)
- `POST /api/tasks/move-expired` — Moves tasks with past dates (and `"a definir"` tasks) to today's date
- `POST /api/tasks/delete-all` — Soft-delete all active tasks
- `POST /api/tasks/import` — Bulk import tasks (expects `{ tasks: Task[] }`)
- `GET /api/logs` — Fetch audit logs (limit via `?limit=200`)
- `GET /api/health` — Health check endpoint
- `POST /api/parse` — Sends raw Spanish text to OpenAI `gpt-4o-mini` and returns structured `{ actions, summary }`. The AI prompt is inlined in `routes.ts:248`. Rate-limited to 30 req/min.

### Dev server

In development, Vite runs as Express middleware (`server/vite.ts`), so a single process on port 5000 serves both the API and the HMR-enabled client. In production, static files are served from `dist/public/`.

### Environment variables

The server imports `dotenv/config` at startup, which auto-loads variables from a `.env` file in the project root.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `OPENAI_API_KEY` | Required for the `/api/parse` AI endpoint |
| `NODE_ENV` | `development` enables Vite middleware; `production` serves static files |

In development, create a `.env` file with your secrets. In production (Railway/Replit), set these via platform env var settings — they won't be committed to git.
