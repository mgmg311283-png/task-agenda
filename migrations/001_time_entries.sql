-- Medición de tiempo por tarea.
-- Puramente aditivo: crea una tabla nueva, no altera ninguna existente.
--
-- timestamptz (y no `timestamp` como el resto del esquema) es deliberado: el
-- servidor corre en UTC y los usuarios están en UTC-3, y agrupar "cuánto
-- trabajé el martes" exige convertir a día local sin ambigüedad.

CREATE TABLE IF NOT EXISTS time_entries (
  id           serial PRIMARY KEY,
  task_id      integer     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id      integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  auto_closed  boolean     NOT NULL DEFAULT false,
  source       text        NOT NULL DEFAULT 'UI'
);

-- La regla "una sola tarea a la vez" la impone la base, no el código: con esto
-- es imposible que queden dos timers abiertos para el mismo usuario aunque
-- haya una carrera entre el celular y la computadora.
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_running_per_user
  ON time_entries (user_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS time_entries_user_started_idx ON time_entries (user_id, started_at);
CREATE INDEX IF NOT EXISTS time_entries_task_idx         ON time_entries (task_id);
