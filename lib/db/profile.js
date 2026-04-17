import { getCacheJson, setCacheJson } from "./cache";
import { getDb, normalizeText, nowIso } from "./core";
import { isCentralDbEnabled, requestCentralJson } from "./remote";

async function ensureProfileSchema() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY NOT NULL,
      bio TEXT,
      favorite_topics_json TEXT NOT NULL DEFAULT '[]',
      enable_push INTEGER NOT NULL DEFAULT 1,
      enable_email INTEGER NOT NULL DEFAULT 0,
      is_private INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getUserProfile(userId) {
  if (isCentralDbEnabled()) {
    const cleanUserId = normalizeText(userId);
    if (!cleanUserId) return null;

    const data = await requestCentralJson("/api/profile", {}, { userId: cleanUserId });
    return data?.profile || null;
  }

  const db = await getDb();
  const cleanUserId = normalizeText(userId);
  if (!cleanUserId) return null;

  await ensureProfileSchema();

  const row = await db.getFirstAsync(
    `
      SELECT
        u.id,
        u.username,
        u.email,
        u.avatar_url,
        u.role,
        COALESCE(j.full_name, u.username) AS full_name,
        COALESCE(up.bio, '') AS bio,
        COALESCE(up.favorite_topics_json, '[]') AS favorite_topics_json,
        COALESCE(up.enable_push, 1) AS enable_push,
        COALESCE(up.enable_email, 0) AS enable_email,
        COALESCE(up.is_private, 0) AS is_private
      FROM users u
      LEFT JOIN journalists j ON j.user_id = u.id
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
    `,
    [cleanUserId],
  );

  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    fullName: row.full_name,
    bio: row.bio || "",
    favoriteTopics: parseJsonArray(row.favorite_topics_json),
    enablePush: row.enable_push === 1,
    enableEmail: row.enable_email === 1,
    isPrivate: row.is_private === 1,
  };
}

export async function updateUserProfile(userId, payload) {
  if (isCentralDbEnabled()) {
    const cleanUserId = normalizeText(userId);
    if (!cleanUserId) {
      throw new Error("Không xác định được người dùng.");
    }

    const data = await requestCentralJson(
      `/api/profile/${encodeURIComponent(cleanUserId)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload || {}),
      },
    );

    const profile = data?.profile || null;
    if (!profile?.id) {
      throw new Error("Không thể cập nhật hồ sơ.");
    }

    const currentUser = await getCacheJson("current_user", null);
    if (currentUser?.id === cleanUserId) {
      await setCacheJson("current_user", {
        ...currentUser,
        username: profile.username,
        fullName: profile.fullName || profile.username,
        avatarUrl: profile.avatarUrl || null,
      });
    }

    return profile;
  }

  const db = await getDb();
  const cleanUserId = normalizeText(userId);
  if (!cleanUserId) {
    throw new Error("Không xác định được người dùng.");
  }

  await ensureProfileSchema();

  const username = normalizeText(payload?.username);
  const fullName = normalizeText(payload?.fullName);
  const avatarUrl = normalizeText(payload?.avatarUrl) || null;
  const bio = normalizeText(payload?.bio);
  const favoriteTopics = Array.isArray(payload?.favoriteTopics)
    ? payload.favoriteTopics.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  const enablePush = payload?.enablePush ? 1 : 0;
  const enableEmail = payload?.enableEmail ? 1 : 0;
  const isPrivate = payload?.isPrivate ? 1 : 0;

  if (!username) {
    throw new Error("Username không được để trống.");
  }

  const conflict = await db.getFirstAsync(
    "SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1",
    [username, cleanUserId],
  );
  if (conflict?.id) {
    throw new Error("Username đã tồn tại.");
  }

  await db.runAsync("UPDATE users SET username = ?, avatar_url = ? WHERE id = ?", [
    username,
    avatarUrl,
    cleanUserId,
  ]);

  const roleRow = await db.getFirstAsync("SELECT role FROM users WHERE id = ? LIMIT 1", [
    cleanUserId,
  ]);

  if (roleRow?.role === "journalist") {
    await db.runAsync("UPDATE journalists SET full_name = ? WHERE user_id = ?", [
      fullName || username,
      cleanUserId,
    ]);
  }

  await db.runAsync(
    `
      INSERT INTO user_profiles (
        user_id,
        bio,
        favorite_topics_json,
        enable_push,
        enable_email,
        is_private,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        bio = excluded.bio,
        favorite_topics_json = excluded.favorite_topics_json,
        enable_push = excluded.enable_push,
        enable_email = excluded.enable_email,
        is_private = excluded.is_private,
        updated_at = excluded.updated_at
    `,
    [
      cleanUserId,
      bio,
      JSON.stringify(favoriteTopics),
      enablePush,
      enableEmail,
      isPrivate,
      nowIso(),
    ],
  );

  const currentUser = await getCacheJson("current_user", null);
  if (currentUser?.id === cleanUserId) {
    await setCacheJson("current_user", {
      ...currentUser,
      username,
      fullName: fullName || username,
      avatarUrl,
    });
  }

  return await getUserProfile(cleanUserId);
}
