# replit.md

## Overview

Focus Task Agenda is a single-user task management application designed for personal productivity. It displays tasks on a Kanban-style board with three columns: **URGENTE** (urgent), **ACCION** (action), and **PENSAR** (think). The app supports natural language command input (chat interface) for creating, editing, completing, and deleting tasks. It includes full audit logging of all changes, metrics/reporting views, and CSV import/export. The UI follows a brutalist design aesthetic with sharp corners and monospace typography.

The application is built as a full-stack TypeScript project with a React frontend and Express backend, using PostgreSQL for data persistence via Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router) with three routes: Dashboard (`/`), Log (`/log`), Metrics (`/metrics`)
- **State Management**: React Context (`TaskProvider`) wrapping TanStack React Query for server state. The context provides a `dispatch` function that translates actions into API calls via mutations, then invalidates query caches.
- **UI Components**: shadcn/ui component library (new-york style) built on Radix UI primitives, styled with Tailwind CSS v4
- **Drag & Drop**: @dnd-kit for Kanban board column reordering
- **Natural Language Parsing**: AI-powered parser using OpenAI (gpt-5-mini via Replit AI Integrations) for intelligent task interpretation. Server endpoint `/api/parse` receives raw Spanish text (voice-dictated or typed) and returns structured task actions. Handles connectors like "y" intelligently (keeps "pan y leche" as one task, separates distinct tasks). Legacy regex parser in `client/src/lib/parser.ts` still available as fallback reference.
- **CSV Handling**: PapaParse for import/export of task data
- **Design**: Brutalist aesthetic — `--radius: 0rem` for sharp corners, JetBrains Mono for monospace elements, Inter for body text. Custom CSS variables for column colors (urgent/action/think).

### Backend (server/)
- **Framework**: Express.js running on Node.js with TypeScript (transpiled via tsx in dev, esbuild for production)
- **API Design**: RESTful JSON API under `/api/` prefix
  - `/api/tasks` — CRUD for tasks (GET active, POST create, PATCH update, DELETE)
  - `/api/tasks/all` — GET all tasks including completed/deleted (for metrics)
  - `/api/tasks/next-id` — GET next available task ID
  - `/api/tasks/move-expired` — POST to move overdue tasks to today
  - `/api/tasks/delete-all` — POST to delete all active tasks
  - `/api/tasks/import` — POST for CSV import
  - `/api/logs` — GET audit log entries
- **Storage Layer**: `DatabaseStorage` class implementing `IStorage` interface, enabling potential swap of storage backends
- **Dev Server**: Vite dev server is integrated as middleware in development mode (server/vite.ts), with HMR support. In production, static files are served from `dist/public`.

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema** (shared/schema.ts):
  - `tasks` table: id (serial PK), text, date, person, type (accion/para_pensar/a_definir), urgent (boolean), status (activa/completada/eliminada), createdAt, updatedAt
  - `logs` table: id (UUID), timestamp, action, details, taskId, originalValues (JSON string), newValues (JSON string), source (UI/Chat/Audio/Import)
- **Migrations**: Managed via `drizzle-kit push` command (`npm run db:push`)
- **Connection**: pg Pool using `DATABASE_URL` environment variable
- **Validation**: Zod schemas auto-generated from Drizzle schema via `drizzle-zod`

### Shared Code (shared/)
- Schema definitions and TypeScript types are shared between frontend and backend
- Path alias `@shared/*` maps to `shared/*` directory

### Build System
- **Development**: `tsx server/index.ts` runs the server with Vite middleware for HMR
- **Production Build**: Custom build script (`script/build.ts`) that runs Vite build for client and esbuild for server, outputting to `dist/`. Server dependencies are selectively bundled to reduce cold start times.
- **Output**: `dist/public/` for client assets, `dist/index.cjs` for server

## External Dependencies

### Required Services
- **PostgreSQL Database**: Required. Connection via `DATABASE_URL` environment variable. The app uses Drizzle ORM with the PostgreSQL dialect and `pg` driver.

### Key NPM Packages
- **@tanstack/react-query**: Server state management and caching
- **drizzle-orm** + **drizzle-kit**: Database ORM and migration tooling
- **chrono-node**: Natural language date parsing (supports Spanish dates)
- **papaparse**: CSV parsing and generation for import/export
- **@dnd-kit/core** + **@dnd-kit/sortable**: Drag-and-drop for Kanban board
- **date-fns**: Date formatting and manipulation
- **wouter**: Lightweight client-side routing
- **zod** + **drizzle-zod**: Schema validation
- **recharts**: Charting library (available for metrics views)

- **openai**: OpenAI SDK for AI-powered task parsing (via Replit AI Integrations)

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `NODE_ENV` — Controls dev/production mode behavior
- `OPENAI_API_KEY` — OpenAI API key (user-provided secret, used for gpt-4o-mini)