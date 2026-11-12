// Ids of passages and reading attempts are never reused (SPEC §6.10). `id_floor` keeps the highest id ever given
// to each, so it survives the deletion of the row that held it.

/** SQL for the next free id of `table`: past both its largest id and its floor. */
export function nextId(table: 'passages' | 'reading_attempts'): string {
  return `MAX(COALESCE((SELECT MAX(id) FROM ${table}), 0),
    COALESCE((SELECT value FROM id_floor WHERE name = '${table}'), 0)) + 1`
}

/**
 * A statement that raises the floor of `table` to the largest id among the rows `where` (bound to `binds`) selects.
 * Put it in the batch before the DELETE that removes those rows; it does nothing when no row matches.
 */
export function raiseFloor(
  db: D1Database,
  table: 'passages' | 'reading_attempts',
  where: string,
  ...binds: unknown[]
) {
  return db
    .prepare(
      `INSERT INTO id_floor (name, value) SELECT '${table}', MAX(id) FROM ${table} WHERE ${where} HAVING COUNT(*) > 0
       ON CONFLICT (name) DO UPDATE SET value = MAX(value, excluded.value)`,
    )
    .bind(...binds)
}
