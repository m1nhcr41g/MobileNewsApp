import { getDb } from "./core";

export async function getCacheJson(key, fallbackValue = null) {
  const db = await getDb();
  const row = await db.getFirstAsync("SELECT value FROM app_cache WHERE key = ?", [
    key,
  ]);

  if (!row || !row.value) {
    return fallbackValue;
  }

  try {
    return JSON.parse(row.value);
  } catch {
    return fallbackValue;
  }
}

export async function setCacheJson(key, value) {
  const db = await getDb();
  const payload = JSON.stringify(value);

  await db.runAsync(
    `
      INSERT INTO app_cache (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `,
    [key, payload],
  );
}
