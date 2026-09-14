-- Hasta 3 cronómetros simultáneos por persona (antes: uno solo).
--
-- El índice viejo imponía "una sola tarea a la vez" desde la base. El pedido
-- pasó a ser hasta tres en paralelo, y "como máximo 3 filas" no se puede
-- expresar con un índice único: eso queda en el código
-- (storage.startTimer cuenta las abiertas dentro de una transacción con
-- pg_advisory_xact_lock por usuario, así dos clicks simultáneos no dejan 4).
DROP INDEX IF EXISTS time_entries_one_running_per_user;

-- Lo que SÍ sigue siendo una regla de la base: no puede haber dos entradas
-- abiertas para la MISMA tarea y usuario. Si pasara, el reporte de Métricas
-- contaría ese tiempo dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_running_per_task
  ON time_entries (user_id, task_id) WHERE ended_at IS NULL;
