-- Atajos de la barra editables desde la UI (crear, renombrar, cambiar
-- icono, dar de baja) en vez de estar hardcodeados en el codigo.
--
-- Antes el icono de cada atajo se elegia por POSICION en el cliente
-- (ICONOS[indice] en quick-task-bar.tsx, indexado por el orden ascendente
-- de quick_slot). Ahora vive en la fila para poder asignarlo desde la UI.
-- Puramente aditivo: agrega una columna nullable, no toca ninguna fila
-- fuera del backfill de abajo, y no borra nada.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS icon text;

-- Backfill de los 3 atajos existentes para que conserven el icono que ya
-- tenian (mismo mapeo que el ICONOS[] que reemplaza este cambio: el atajo
-- de menor quick_slot es Mail, el siguiente MessageCircle, el siguiente
-- Zap). Se ata a quick_slot -- no al id -- porque esa es la clave que
-- determinaba el icono antes de este cambio. El "AND icon IS NULL" hace
-- que sea seguro re-correr esta migracion sin pisar un icono ya elegido
-- a mano desde la UI nueva.
UPDATE tasks SET icon = 'Mail'          WHERE quick_slot = 1 AND icon IS NULL;
UPDATE tasks SET icon = 'MessageCircle' WHERE quick_slot = 2 AND icon IS NULL;
UPDATE tasks SET icon = 'Zap'           WHERE quick_slot = 3 AND icon IS NULL;

-- El server calcula el proximo slot libre en la app (nextFreeQuickSlot en
-- storage.ts), pero eso no evita una carrera si dos altas de atajo llegan al
-- mismo tiempo. Mismo criterio que time_entries_one_running_per_user: la
-- regla la impone la base, no el codigo. Solo entre atajos ACTIVOS -- uno
-- desactivado libera su numero para reasignar.
CREATE UNIQUE INDEX IF NOT EXISTS tasks_quick_slot_active_idx
  ON tasks (quick_slot) WHERE status = 'activa' AND quick_slot IS NOT NULL;
