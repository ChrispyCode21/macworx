// Ids of passages and reading attempts are never reused (SPEC §6.10). `id_floor` keeps the highest id ever given
// to each, so it survives the deletion of the row that held it.

/** SQL for the next free id of `table`: past both its largest id and its floor. */
export function nextId(table: 'passages' | 'reading_attempts'): string {
  return `MAX(COALESCE((SELECT MAX(id) FROM ${table}), 0),
    COALESCE((SELECT value FROM id_floor WHERE name = '${table}'), 0)) + 1`
}
