// Đăng ký tài khoản admin
export async function registerAdmin({ username, email, password }) {
  if (isCentralDbEnabled()) {
    const cleanUsername = normalizeText(username);
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = normalizeText(password);

    if (!cleanUsername || !cleanEmail || !cleanPassword) {
      throw new Error("Vui lòng nhập đầy đủ thông tin.");
    }
    if (!isValidEmail(cleanEmail)) {
      throw new Error("Email không hợp lệ.");
    }
    if (cleanPassword.length < 6) {
      throw new Error("Mật khẩu tối thiểu 6 ký tự.");
    }

    const data = await requestCentralJson("/api/auth/register-admin", {
      method: "POST",
      body: JSON.stringify({
        username: cleanUsername,
        email: cleanEmail,
        password: cleanPassword,
      }),
    });

    const profile = data?.profile || null;
    if (!profile?.id) {
      throw new Error("Không thể đăng ký admin.");
    }

    await saveCurrentUser(profile);
    return profile;
  }

  const db = await getDb();
  const cleanUsername = normalizeText(username);
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = normalizeText(password);

  if (!cleanUsername || !cleanEmail || !cleanPassword) {
    throw new Error("Vui lòng nhập đầy đủ thông tin.");
  }
  if (!isValidEmail(cleanEmail)) {
    throw new Error("Email không hợp lệ.");
  }
  if (cleanPassword.length < 6) {
    throw new Error("Mật khẩu tối thiểu 6 ký tự.");
  }

  await assertUserNotExists({ username: cleanUsername, email: cleanEmail });

  const userId = makeId("user");
  const createdAt = nowIso();

  await db.runAsync(
    `
      INSERT INTO users
      (id, username, email, password_hash, avatar_url, role, is_active, created_at)
      VALUES (?, ?, ?, ?, NULL, 'admin', 1, ?)
    `,
    [userId, cleanUsername, cleanEmail, cleanPassword, createdAt],
  );

  const profile = {
    id: userId,
    username: cleanUsername,
    email: cleanEmail,
    role: "admin",
    fullName: cleanUsername,
  };

  await saveCurrentUser(profile);
  return profile;
}
import {
  getDb,
  isValidEmail,
  makeId,
  normalizeEmail,
  normalizeText,
  nowIso,
} from "./core";
import { getCacheJson, setCacheJson } from "./cache";
import { isCentralDbEnabled, requestCentralJson } from "./remote";

async function saveCurrentUser(profile) {
  await setCacheJson("current_user", profile);
}

async function assertUserNotExists({ username, email }) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `
      SELECT id
      FROM users
      WHERE email = ? COLLATE NOCASE
         OR username = ?
      LIMIT 1
    `,
    [normalizeEmail(email), normalizeText(username)],
  );

  if (row) {
    throw new Error("Email hoặc username đã tồn tại.");
  }
}

export async function getCurrentUser() {
  return await getCacheJson("current_user", null);
}

export async function logout() {
  await setCacheJson("current_user", null);
}

export async function initAuthSchema() {
  if (isCentralDbEnabled()) {
    await requestCentralJson("/health");
    return;
  }

  const db = await getDb();

  await db.execAsync(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);",
  );
  await db.execAsync(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);",
  );
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);",
  );
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_journalists_user_id ON journalists(user_id);",
  );
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS article_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      article_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_uri TEXT,
      mime_type TEXT,
      file_size INTEGER,
      source_type TEXT NOT NULL DEFAULT 'word',
      process_status TEXT NOT NULL DEFAULT 'pending',
      extracted_content TEXT,
      created_at TEXT NOT NULL
    );
  `);
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_article_attachments_article_id ON article_attachments(article_id);",
  );
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_reading_history (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      article_id TEXT NOT NULL,
      viewed_at TEXT NOT NULL
    );
  `);
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_user_reading_history_user_id ON user_reading_history(user_id);",
  );
  await db.execAsync(
    "CREATE INDEX IF NOT EXISTS idx_user_reading_history_article_id ON user_reading_history(article_id);",
  );

  try{
    await db.execAsync("ALTER TABLE articles ADD COLUMN summary TEXT;")
  }catch{}
  try{
    await db.execAsync("ALTER TABLE articles ADD COLUMN content_html TEXT;")
  }catch{}
}

export async function registerUser({ username, email, password }) {
  if (isCentralDbEnabled()) {
    const cleanUsername = normalizeText(username);
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = normalizeText(password);

    if (!cleanUsername || !cleanEmail || !cleanPassword) {
      throw new Error("Vui lòng nhập đầy đủ thông tin.");
    }
    if (!isValidEmail(cleanEmail)) {
      throw new Error("Email không hợp lệ.");
    }
    if (cleanPassword.length < 6) {
      throw new Error("Mật khẩu tối thiểu 6 ký tự.");
    }

    const data = await requestCentralJson("/api/auth/register-user", {
      method: "POST",
      body: JSON.stringify({
        username: cleanUsername,
        email: cleanEmail,
        password: cleanPassword,
      }),
    });

    const profile = data?.profile || null;
    if (!profile?.id) {
      throw new Error("Không thể đăng ký người dùng.");
    }

    await saveCurrentUser(profile);
    return profile;
  }

  const db = await getDb();

  const cleanUsername = normalizeText(username);
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = normalizeText(password);

  if (!cleanUsername || !cleanEmail || !cleanPassword) {
    throw new Error("Vui lòng nhập đầy đủ thông tin.");
  }
  if (!isValidEmail(cleanEmail)) {
    throw new Error("Email không hợp lệ.");
  }
  if (cleanPassword.length < 6) {
    throw new Error("Mật khẩu tối thiểu 6 ký tự.");
  }

  await assertUserNotExists({ username: cleanUsername, email: cleanEmail });

  const userId = makeId("user");
  const createdAt = nowIso();

  await db.runAsync(
    `
      INSERT INTO users
      (id, username, email, password_hash, avatar_url, role, is_active, created_at)
      VALUES (?, ?, ?, ?, NULL, 'user', 1, ?)
    `,
    [userId, cleanUsername, cleanEmail, cleanPassword, createdAt],
  );

  const profile = {
    id: userId,
    username: cleanUsername,
    email: cleanEmail,
    role: "user",
    fullName: cleanUsername,
  };

  await saveCurrentUser(profile);
  return profile;
}

export async function registerJournalist({
  fullName,
  username,
  email,
  password,
}) {
  if (isCentralDbEnabled()) {
    const cleanFullName = normalizeText(fullName);
    const cleanUsername = normalizeText(username);
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = normalizeText(password);

    if (!cleanFullName || !cleanUsername || !cleanEmail || !cleanPassword) {
      throw new Error("Vui lòng nhập đầy đủ thông tin.");
    }
    if (!isValidEmail(cleanEmail)) {
      throw new Error("Email không hợp lệ.");
    }
    if (cleanPassword.length < 6) {
      throw new Error("Mật khẩu tối thiểu 6 ký tự.");
    }

    const data = await requestCentralJson("/api/auth/register-journalist", {
      method: "POST",
      body: JSON.stringify({
        fullName: cleanFullName,
        username: cleanUsername,
        email: cleanEmail,
        password: cleanPassword,
      }),
    });

    const profile = data?.profile || null;
    if (!profile?.id) {
      throw new Error("Không thể đăng ký nhà báo.");
    }

    await saveCurrentUser(profile);
    return profile;
  }

  const db = await getDb();

  const cleanFullName = normalizeText(fullName);
  const cleanUsername = normalizeText(username);
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = normalizeText(password);

  if (!cleanFullName || !cleanUsername || !cleanEmail || !cleanPassword) {
    throw new Error("Vui lòng nhập đầy đủ thông tin.");
  }
  if (!isValidEmail(cleanEmail)) {
    throw new Error("Email không hợp lệ.");
  }
  if (cleanPassword.length < 6) {
    throw new Error("Mật khẩu tối thiểu 6 ký tự.");
  }

  await assertUserNotExists({ username: cleanUsername, email: cleanEmail });

  const userId = makeId("user");
  const journalistId = makeId("jour");
  const createdAt = nowIso();

  await db.runAsync(
    `
      INSERT INTO users
      (id, username, email, password_hash, avatar_url, role, is_active, created_at)
      VALUES (?, ?, ?, ?, NULL, 'journalist', 1, ?)
    `,
    [userId, cleanUsername, cleanEmail, cleanPassword, createdAt],
  );

  await db.runAsync(
    `
      INSERT INTO journalists
      (id, user_id, full_name, bio, press_card_number, organization, is_verified, verified_at)
      VALUES (?, ?, ?, NULL, NULL, NULL, 0, NULL)
    `,
    [journalistId, userId, cleanFullName],
  );

  const profile = {
    id: userId,
    username: cleanUsername,
    email: cleanEmail,
    role: "journalist",
    fullName: cleanFullName,
  };

  await saveCurrentUser(profile);
  return profile;
}

export async function loginAccount({ identifier, password, role }) {
  if (isCentralDbEnabled()) {
    const cleanIdentifier = normalizeText(identifier);
    const cleanPassword = normalizeText(password);
    const cleanRole = normalizeText(role).toLowerCase();

    if (!cleanIdentifier || !cleanPassword) {
      throw new Error("Vui lòng nhập tài khoản và mật khẩu.");
    }
    if (!["user", "journalist"].includes(cleanRole)) {
      throw new Error("Vai trò đăng nhập không hợp lệ.");
    }

    const data = await requestCentralJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: cleanIdentifier,
        password: cleanPassword,
        role: cleanRole,
      }),
    });

    const profile = data?.profile || null;
    if (!profile?.id) {
      throw new Error("Không thể đăng nhập.");
    }

    await saveCurrentUser(profile);
    return profile;
  }

  const db = await getDb();

  const cleanIdentifier = normalizeText(identifier);
  const cleanPassword = normalizeText(password);
  const cleanRole = normalizeText(role).toLowerCase();

  if (!cleanIdentifier || !cleanPassword) {
    throw new Error("Vui lòng nhập tài khoản và mật khẩu.");
  }
  if (!["user", "journalist"].includes(cleanRole)) {
    throw new Error("Vai trò đăng nhập không hợp lệ.");
  }

  const row = await db.getFirstAsync(
    `
      SELECT
        u.id,
        u.username,
        u.email,
        u.role,
        u.is_active,
        j.full_name
      FROM users u
      LEFT JOIN journalists j ON j.user_id = u.id
      WHERE
        (u.email = ? COLLATE NOCASE OR u.username = ?)
        AND u.password_hash = ?
        AND u.role = ?
      LIMIT 1
    `,
    [cleanIdentifier, cleanIdentifier, cleanPassword, cleanRole],
  );

  if (!row) {
    throw new Error("Sai tài khoản hoặc mật khẩu.");
  }
  if (row.is_active !== 1) {
    throw new Error("Tài khoản đã bị khóa.");
  }

  const profile = {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    fullName: row.full_name || row.username,
  };

  await saveCurrentUser(profile);
  return profile;
}
