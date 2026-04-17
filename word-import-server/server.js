const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mammoth = require("mammoth");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 8790;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "football_news.db");

let dbPromise;

function normalizeText(value) {
  return String(value || "").trim().normalize("NFC");
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function normalizeLimit(limit, fallbackValue) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return fallbackValue;
  return Math.floor(value);
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(title) {
  return normalizeText(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function stripHtml(value) {
  return normalizeText(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function normalizeTagName(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function makeTagSlug(tagName) {
  return normalizeTagName(tagName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function mapNewsRow(item) {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    summary: item.summary || "",
    content: item.content,
    content_html: item.content_html || "",
    thumbnail_url: item.thumbnail_url,
    status: item.status,
    view_count: item.view_count || 0,
    published_at: item.published_at,
    updated_at: item.updated_at,
    created_at: item.created_at,
    category_id: item.category_id,
    category_name: item.category_name || "Khac",
    journalist_name: item.journalist_name || "Nha bao",
    tags: item.tag_names ? item.tag_names.split("||").filter(Boolean) : [],
  };
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY NOT NULL,
          username TEXT NOT NULL,
          email TEXT,
          password_hash TEXT,
          avatar_url TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS journalists (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          full_name TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          slug TEXT,
          description TEXT
        );

        CREATE TABLE IF NOT EXISTS articles (
          id TEXT PRIMARY KEY NOT NULL,
          journalist_id TEXT NOT NULL,
          journalist_name TEXT,
          category_id TEXT NOT NULL,
          title TEXT NOT NULL,
          slug TEXT NOT NULL,
          summary TEXT,
          content TEXT NOT NULL,
          content_html TEXT,
          thumbnail_url TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          view_count INTEGER NOT NULL DEFAULT 0,
          published_at TEXT,
          updated_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          slug TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS article_tags (
          article_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (article_id, tag_id)
        );

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

        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY NOT NULL,
          article_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          parent_id TEXT,
          content TEXT NOT NULL,
          is_approved INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_reading_history (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          article_id TEXT NOT NULL,
          viewed_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_profiles (
          user_id TEXT PRIMARY KEY NOT NULL,
          bio TEXT,
          favorite_topics_json TEXT NOT NULL DEFAULT '[]',
          enable_push INTEGER NOT NULL DEFAULT 1,
          enable_email INTEGER NOT NULL DEFAULT 0,
          is_private INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
        CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
        CREATE INDEX IF NOT EXISTS idx_articles_journalist_id ON articles(journalist_id);
        CREATE INDEX IF NOT EXISTS idx_article_tags_article ON article_tags(article_id);
        CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag_id);
        CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
        CREATE INDEX IF NOT EXISTS idx_read_history_user ON user_reading_history(user_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_journalists_user_id ON journalists(user_id);
      `);

      try {
        await db.exec("ALTER TABLE articles ADD COLUMN summary TEXT;");
      } catch {}
      try {
        await db.exec("ALTER TABLE articles ADD COLUMN content_html TEXT;");
      } catch {}
      try {
        await db.exec("ALTER TABLE articles ADD COLUMN journalist_name TEXT;");
      } catch {}
      try {
        await db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT;");
      } catch {}
      try {
        await db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT;");
      } catch {}

      const categoryCount = await db.get("SELECT COUNT(*) AS count FROM categories");
      if (!categoryCount?.count) {
        await db.run(
          `
            INSERT INTO categories (id, name, slug, description)
            VALUES (?, 'Tin tong hop', 'tin-tong-hop', 'Danh muc mac dinh')
          `,
          [makeId("cat")],
        );
      }

      return db;
    });
  }

  return dbPromise;
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getDbTableNames(db) {
  const rows = await db.all(
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
    `,
  );

  return rows.map((item) => item.name);
}

async function isValidTableName(db, tableName) {
  const cleanTable = normalizeText(tableName);
  if (!/^[a-zA-Z0-9_]+$/.test(cleanTable)) {
    return false;
  }

  const row = await db.get(
    `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
      LIMIT 1
    `,
    [cleanTable],
  );

  return Boolean(row?.name);
}

async function ensureDefaultCategory(db) {
  const row = await db.get("SELECT id FROM categories ORDER BY name LIMIT 1");
  if (row?.id) return row.id;

  const categoryId = makeId("cat");
  await db.run(
    `
      INSERT INTO categories (id, name, slug, description)
      VALUES (?, 'Tin tong hop', 'tin-tong-hop', 'Danh muc mac dinh')
    `,
    [categoryId],
  );
  return categoryId;
}

async function ensureTagByName(db, tagName) {
  const cleanName = normalizeTagName(tagName);
  if (!cleanName) return null;

  const existing = await db.get(
    "SELECT id FROM tags WHERE name = ? COLLATE NOCASE LIMIT 1",
    [cleanName],
  );
  if (existing?.id) return existing.id;

  const tagId = makeId("tag");
  const slugBase = makeTagSlug(cleanName) || `tag-${Date.now()}`;
  const slug = `${slugBase}-${Date.now()}`;
  await db.run("INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)", [tagId, cleanName, slug]);
  return tagId;
}

async function syncArticleTags(db, articleId, tagsInput) {
  const cleanArticleId = normalizeText(articleId);
  const names = Array.isArray(tagsInput)
    ? tagsInput.map((item) => normalizeTagName(item)).filter(Boolean)
    : [];

  const uniqueNames = [...new Set(names.map((item) => item.toLowerCase()))];
  const normalizedByLower = {};
  names.forEach((item) => {
    normalizedByLower[item.toLowerCase()] = item;
  });

  await db.run("DELETE FROM article_tags WHERE article_id = ?", [cleanArticleId]);

  for (const lowered of uniqueNames) {
    const tagId = await ensureTagByName(db, normalizedByLower[lowered]);
    if (!tagId) continue;
    await db.run("INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)", [
      cleanArticleId,
      tagId,
    ]);
  }
}

async function replaceArticleAttachments(db, articleId, attachmentsInput) {
  const cleanArticleId = normalizeText(articleId);
  const attachments = Array.isArray(attachmentsInput) ? attachmentsInput : [];
  await db.run("DELETE FROM article_attachments WHERE article_id = ?", [cleanArticleId]);

  for (const file of attachments) {
    const fileName = normalizeText(file?.fileName || file?.name);
    if (!fileName) continue;

    await db.run(
      `
        INSERT INTO article_attachments (
          id,
          article_id,
          file_name,
          file_uri,
          mime_type,
          file_size,
          source_type,
          process_status,
          extracted_content,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        makeId("attach"),
        cleanArticleId,
        fileName,
        normalizeText(file?.fileUri || file?.uri) || null,
        normalizeText(file?.mimeType || file?.mime) || null,
        Number.isFinite(file?.fileSize) ? file.fileSize : null,
        normalizeText(file?.sourceType) || "word",
        normalizeText(file?.processStatus) || "pending",
        normalizeText(file?.extractedContent) || null,
        nowIso(),
      ],
    );
  }
}

app.use(cors());
app.use(express.json({ limit: "30mb" }));


app.get("/health", async (_req, res) => {
  try {
    await getDb();
    res.json({ ok: true, service: "news-server", dbPath: DB_PATH });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});


app.post("/api/auth/register-user", async (req, res) => {
  try {
    const db = await getDb();
    const username = normalizeText(req.body?.username);
    const email = normalizeEmail(req.body?.email);
    const password = normalizeText(req.body?.password);

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Vui long nhap day du thong tin." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Email khong hop le." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Mat khau toi thieu 6 ky tu." });
    }

    const conflict = await db.get(
      `
        SELECT id
        FROM users
        WHERE email = ? COLLATE NOCASE OR username = ?
        LIMIT 1
      `,
      [email, username],
    );
    if (conflict?.id) {
      return res.status(409).json({ message: "Email hoac username da ton tai." });
    }

    const userId = makeId("user");
    const createdAt = nowIso();
    await db.run(
      `
        INSERT INTO users
        (id, username, email, password_hash, avatar_url, role, is_active, created_at)
        VALUES (?, ?, ?, ?, NULL, 'user', 1, ?)
      `,
      [userId, username, email, password, createdAt],
    );

    res.status(201).json({
      profile: {
        id: userId,
        username,
        email,
        role: "user",
        fullName: username,
        avatarUrl: null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Khong the dang ky nguoi dung.", detail: error.message });
  }
});

app.post("/api/auth/register-journalist", async (req, res) => {
  try {
    const db = await getDb();
    const fullName = normalizeText(req.body?.fullName);
    const username = normalizeText(req.body?.username);
    const email = normalizeEmail(req.body?.email);
    const password = normalizeText(req.body?.password);

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ message: "Vui long nhap day du thong tin." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Email khong hop le." });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Mat khau toi thieu 6 ky tu." });
    }

    const conflict = await db.get(
      `
        SELECT id
        FROM users
        WHERE email = ? COLLATE NOCASE OR username = ?
        LIMIT 1
      `,
      [email, username],
    );
    if (conflict?.id) {
      return res.status(409).json({ message: "Email hoac username da ton tai." });
    }

    const userId = makeId("user");
    const journalistId = makeId("jour");
    const createdAt = nowIso();

    await db.run(
      `
        INSERT INTO users
        (id, username, email, password_hash, avatar_url, role, is_active, created_at)
        VALUES (?, ?, ?, ?, NULL, 'journalist', 1, ?)
      `,
      [userId, username, email, password, createdAt],
    );

    await db.run(
      `
        INSERT INTO journalists
        (id, user_id, full_name, bio, press_card_number, organization, is_verified, verified_at)
        VALUES (?, ?, ?, NULL, NULL, NULL, 0, NULL)
      `,
      [journalistId, userId, fullName],
    );

    res.status(201).json({
      profile: {
        id: userId,
        username,
        email,
        role: "journalist",
        fullName,
        avatarUrl: null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Khong the dang ky nha bao.", detail: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const db = await getDb();
    const identifier = normalizeText(req.body?.identifier);
    const password = normalizeText(req.body?.password);
    const role = normalizeText(req.body?.role).toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ message: "Vui long nhap tai khoan va mat khau." });
    }
    if (!["user", "journalist"].includes(role)) {
      return res.status(400).json({ message: "Vai tro dang nhap khong hop le." });
    }

    const row = await db.get(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.role,
          u.is_active,
          u.avatar_url,
          j.full_name
        FROM users u
        LEFT JOIN journalists j ON j.user_id = u.id
        WHERE
          (u.email = ? COLLATE NOCASE OR u.username = ?)
          AND u.password_hash = ?
          AND u.role = ?
        LIMIT 1
      `,
      [identifier, identifier, password, role],
    );

    if (!row) {
      return res.status(401).json({ message: "Sai tai khoan hoac mat khau." });
    }
    if (row.is_active !== 1) {
      return res.status(403).json({ message: "Tai khoan da bi khoa." });
    }

    res.json({
      profile: {
        id: row.id,
        username: row.username,
        email: row.email,
        role: row.role,
        fullName: row.full_name || row.username,
        avatarUrl: row.avatar_url || null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Khong the dang nhap.", detail: error.message });
  }
});

app.get("/api/profile", async (req, res) => {
  try {
    const db = await getDb();
    const userId = normalizeText(req.query.userId);
    if (!userId) {
      return res.status(400).json({ message: "Thieu userId." });
    }

    const row = await db.get(
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
      [userId],
    );

    if (!row) {
      return res.status(404).json({ message: "Khong tim thay nguoi dung." });
    }

    res.json({
      profile: {
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
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai ho so.", detail: error.message });
  }
});

app.put("/api/profile/:userId", async (req, res) => {
  try {
    const db = await getDb();
    const userId = normalizeText(req.params.userId);
    if (!userId) {
      return res.status(400).json({ message: "Khong xac dinh duoc nguoi dung." });
    }

    const username = normalizeText(req.body?.username);
    const fullName = normalizeText(req.body?.fullName);
    const avatarUrl = normalizeText(req.body?.avatarUrl) || null;
    const bio = normalizeText(req.body?.bio);
    const favoriteTopics = Array.isArray(req.body?.favoriteTopics)
      ? req.body.favoriteTopics.map((item) => normalizeText(item)).filter(Boolean)
      : [];
    const enablePush = req.body?.enablePush ? 1 : 0;
    const enableEmail = req.body?.enableEmail ? 1 : 0;
    const isPrivate = req.body?.isPrivate ? 1 : 0;

    if (!username) {
      return res.status(400).json({ message: "Username khong duoc de trong." });
    }

    const conflict = await db.get(
      "SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1",
      [username, userId],
    );
    if (conflict?.id) {
      return res.status(409).json({ message: "Username da ton tai." });
    }

    await db.run("UPDATE users SET username = ?, avatar_url = ? WHERE id = ?", [
      username,
      avatarUrl,
      userId,
    ]);

    const roleRow = await db.get("SELECT role FROM users WHERE id = ? LIMIT 1", [userId]);
    if (roleRow?.role === "journalist") {
      await db.run("UPDATE journalists SET full_name = ? WHERE user_id = ?", [
        fullName || username,
        userId,
      ]);
    }

    await db.run(
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
        userId,
        bio,
        JSON.stringify(favoriteTopics),
        enablePush,
        enableEmail,
        isPrivate,
        nowIso(),
      ],
    );

    const updated = await db.get(
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
      [userId],
    );

    res.json({
      profile: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        avatarUrl: updated.avatar_url,
        role: updated.role,
        fullName: updated.full_name,
        bio: updated.bio || "",
        favoriteTopics: parseJsonArray(updated.favorite_topics_json),
        enablePush: updated.enable_push === 1,
        enableEmail: updated.enable_email === 1,
        isPrivate: updated.is_private === 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Khong the cap nhat ho so.", detail: error.message });
  }
});

app.get("/api/categories", async (_req, res) => {
  try {
    const db = await getDb();
    const items = await db.all(
      "SELECT id, name, slug, description FROM categories ORDER BY name ASC",
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai danh muc.", detail: error.message });
  }
});

app.get("/api/tags", async (_req, res) => {
  try {
    const db = await getDb();
    const items = await db.all("SELECT id, name, slug FROM tags ORDER BY name ASC");
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai the tag.", detail: error.message });
  }
});

app.get("/api/journalist/articles", async (req, res) => {
  try {
    const journalistId = normalizeText(req.query.journalistId);
    if (!journalistId) {
      return res.status(400).json({ message: "Thieu journalistId." });
    }

    const db = await getDb();
    const items = await db.all(
      `
        SELECT
          a.id,
          a.title,
          a.slug,
          a.content,
          a.thumbnail_url,
          a.status,
          a.view_count,
          a.published_at,
          a.updated_at,
          a.created_at,
          a.category_id,
          a.summary,
          a.content_html,
          c.name AS category_name,
          (
            SELECT COUNT(*)
            FROM article_attachments aa
            WHERE aa.article_id = a.id
          ) AS attachment_count,
          COALESCE(
            (
              SELECT GROUP_CONCAT(t.name, '||')
              FROM article_tags at
              INNER JOIN tags t ON t.id = at.tag_id
              WHERE at.article_id = a.id
            ),
            ''
          ) AS tag_names
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        WHERE a.journalist_id = ?
        ORDER BY datetime(a.updated_at) DESC, datetime(a.created_at) DESC
      `,
      [journalistId],
    );

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai bai viet nha bao.", detail: error.message });
  }
});

app.get("/api/journalist/attachments", async (req, res) => {
  try {
    const articleId = normalizeText(req.query.articleId);
    if (!articleId) {
      return res.status(400).json({ message: "Thieu articleId." });
    }

    const db = await getDb();
    const items = await db.all(
      `
        SELECT
          id,
          article_id,
          file_name,
          file_uri,
          mime_type,
          file_size,
          source_type,
          process_status,
          extracted_content,
          created_at
        FROM article_attachments
        WHERE article_id = ?
        ORDER BY datetime(created_at) DESC
      `,
      [articleId],
    );

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai tep dinh kem.", detail: error.message });
  }
});

app.post("/api/journalist/articles", async (req, res) => {
  try {
    const db = await getDb();
    const journalistId = normalizeText(req.body?.journalistId);
    if (!journalistId) {
      return res.status(400).json({ message: "Khong xac dinh duoc nha bao." });
    }

    const title = normalizeText(req.body?.title);
    const summary = normalizeText(req.body?.summary);
    const contentHtml = normalizeText(req.body?.contentHtml);
    const plainContent = normalizeText(req.body?.contentPlain || stripHtml(contentHtml || req.body?.content));
    const thumbnailUrl = normalizeText(req.body?.thumbnailUrl) || null;
    const status = normalizeText(req.body?.status) || "draft";

    if (!title || !summary || !plainContent) {
      return res.status(400).json({ message: "Tieu de, tom tat va noi dung la bat buoc." });
    }

    const allowedStatuses = ["draft", "published", "archived"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Trang thai bai viet khong hop le." });
    }

    const articleId = makeId("art");
    const now = nowIso();
    const publishedAt = status === "published" ? now : null;
    const categoryId = normalizeText(req.body?.categoryId) || (await ensureDefaultCategory(db));
    const slugBase = slugify(title) || `bai-viet-${Date.now()}`;
    const slug = `${slugBase}-${Date.now()}`;

    await db.run(
      `
        INSERT INTO articles (
          id,
          journalist_id,
          journalist_name,
          category_id,
          title,
          slug,
          summary,
          content,
          content_html,
          thumbnail_url,
          status,
          view_count,
          published_at,
          updated_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `,
      [
        articleId,
        journalistId,
        normalizeText(req.body?.journalistName) || null,
        categoryId,
        title,
        slug,
        summary,
        plainContent,
        contentHtml || null,
        thumbnailUrl,
        status,
        publishedAt,
        now,
        now,
      ],
    );

    await syncArticleTags(db, articleId, req.body?.tags);
    await replaceArticleAttachments(db, articleId, req.body?.attachments);

    res.status(201).json({ id: articleId });
  } catch (error) {
    res.status(500).json({ message: "Khong the tao bai viet.", detail: error.message });
  }
});

app.put("/api/journalist/articles/:articleId", async (req, res) => {
  try {
    const db = await getDb();
    const journalistId = normalizeText(req.body?.journalistId);
    const articleId = normalizeText(req.params.articleId);

    if (!journalistId || !articleId) {
      return res.status(400).json({ message: "Thieu thong tin cap nhat bai viet." });
    }

    const existing = await db.get(
      "SELECT id, status FROM articles WHERE id = ? AND journalist_id = ? LIMIT 1",
      [articleId, journalistId],
    );
    if (!existing) {
      return res.status(404).json({ message: "Khong tim thay bai viet." });
    }

    const title = normalizeText(req.body?.title);
    const summary = normalizeText(req.body?.summary);
    const contentHtml = normalizeText(req.body?.contentHtml);
    const plainContent = normalizeText(req.body?.contentPlain || stripHtml(contentHtml || req.body?.content));
    const thumbnailUrl = normalizeText(req.body?.thumbnailUrl) || null;
    const status = normalizeText(req.body?.status) || existing.status || "draft";
    const categoryId = normalizeText(req.body?.categoryId) || (await ensureDefaultCategory(db));

    if (!title || !summary || !plainContent) {
      return res.status(400).json({ message: "Khong duoc bo o trong." });
    }

    const allowedStatuses = ["draft", "published", "archived"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Trang thai bai viet khong hop le." });
    }

    const now = nowIso();
    const newSlug = `${slugify(title) || `bai-viet-${Date.now()}`}-${Date.now()}`;

    await db.run(
      `
        UPDATE articles
        SET
          category_id = ?,
          title = ?,
          slug = ?,
          summary = ?,
          content = ?,
          content_html = ?,
          thumbnail_url = ?,
          status = ?,
          published_at = CASE
            WHEN ? = 'published' AND published_at IS NULL THEN ?
            WHEN ? != 'published' THEN NULL
            ELSE published_at
          END,
          updated_at = ?
        WHERE id = ? AND journalist_id = ?
      `,
      [
        categoryId,
        title,
        newSlug,
        summary,
        plainContent,
        contentHtml || null,
        thumbnailUrl,
        status,
        status,
        status === "published" ? now : null,
        status,
        now,
        articleId,
        journalistId,
      ],
    );

    await syncArticleTags(db, articleId, req.body?.tags);
    await replaceArticleAttachments(db, articleId, req.body?.attachments);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Khong the cap nhat bai viet.", detail: error.message });
  }
});

app.delete("/api/journalist/articles/:articleId", async (req, res) => {
  try {
    const db = await getDb();
    const journalistId = normalizeText(req.body?.journalistId);
    const articleId = normalizeText(req.params.articleId);

    if (!journalistId || !articleId) {
      return res.status(400).json({ message: "Thieu thong tin xoa bai viet." });
    }

    await db.run("DELETE FROM article_tags WHERE article_id = ?", [articleId]);
    await db.run("DELETE FROM article_attachments WHERE article_id = ?", [articleId]);
    await db.run("DELETE FROM comments WHERE article_id = ?", [articleId]);
    await db.run("DELETE FROM articles WHERE id = ? AND journalist_id = ?", [articleId, journalistId]);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Khong the xoa bai viet.", detail: error.message });
  }
});

app.patch("/api/journalist/articles/:articleId/status", async (req, res) => {
  try {
    const db = await getDb();
    const journalistId = normalizeText(req.body?.journalistId);
    const articleId = normalizeText(req.params.articleId);
    const status = normalizeText(req.body?.status);

    const allowedStatuses = ["draft", "published", "archived"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Trang thai bai viet khong hop le." });
    }

    const now = nowIso();
    await db.run(
      `
        UPDATE articles
        SET
          status = ?,
          published_at = CASE
            WHEN ? = 'published' AND published_at IS NULL THEN ?
            WHEN ? != 'published' THEN NULL
            ELSE published_at
          END,
          updated_at = ?
        WHERE id = ? AND journalist_id = ?
      `,
      [status, status, status === "published" ? now : null, status, now, articleId, journalistId],
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Khong the cap nhat trang thai.", detail: error.message });
  }
});

async function getPublishedNewsBase(db, limit, orderByClause) {
  const safeLimit = normalizeLimit(limit, 8);
  const rows = await db.all(
    `
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        a.content,
        a.content_html,
        a.thumbnail_url,
        a.status,
        a.view_count,
        a.published_at,
        a.updated_at,
        a.created_at,
        a.category_id,
        c.name AS category_name,
        COALESCE(
          (
            SELECT GROUP_CONCAT(t.name, '||')
            FROM article_tags at
            INNER JOIN tags t ON t.id = at.tag_id
            WHERE at.article_id = a.id
          ),
          ''
        ) AS tag_names,
        COALESCE(a.journalist_name, j.full_name, u.username, 'Nha bao') AS journalist_name
      FROM articles a
      LEFT JOIN categories c ON c.id = a.category_id
      LEFT JOIN users u ON u.id = a.journalist_id
      LEFT JOIN journalists j ON j.user_id = a.journalist_id
      WHERE a.status = 'published'
      ORDER BY ${orderByClause}
      LIMIT ?
    `,
    [safeLimit],
  );

  return rows.map(mapNewsRow);
}

app.get("/api/news/latest", async (req, res) => {
  try {
    const db = await getDb();
    const items = await getPublishedNewsBase(
      db,
      req.query.limit,
      "datetime(COALESCE(a.published_at, a.updated_at, a.created_at)) DESC",
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai tin moi.", detail: error.message });
  }
});

app.get("/api/news/hot", async (req, res) => {
  try {
    const db = await getDb();
    const items = await getPublishedNewsBase(
      db,
      req.query.limit,
      "a.view_count DESC, datetime(COALESCE(a.published_at, a.updated_at, a.created_at)) DESC",
    );
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai tin hot.", detail: error.message });
  }
});

app.get("/api/news/by-categories", async (req, res) => {
  try {
    const db = await getDb();
    const maxCategories = normalizeLimit(req.query.maxCategories, 4);
    const perCategoryLimit = normalizeLimit(req.query.perCategoryLimit, 5);

    const categories = await db.all(
      `
        SELECT
          c.id,
          c.name,
          COUNT(a.id) AS published_count
        FROM categories c
        INNER JOIN articles a ON a.category_id = c.id
        WHERE a.status = 'published'
        GROUP BY c.id, c.name
        ORDER BY published_count DESC, c.name ASC
        LIMIT ?
      `,
      [maxCategories],
    );

    const sections = [];
    for (const category of categories) {
      const rows = await db.all(
        `
          SELECT
            a.id,
            a.title,
            a.slug,
            a.summary,
            a.content,
            a.content_html,
            a.thumbnail_url,
            a.status,
            a.view_count,
            a.published_at,
            a.updated_at,
            a.created_at,
            a.category_id,
            ? AS category_name,
            COALESCE(
              (
                SELECT GROUP_CONCAT(t.name, '||')
                FROM article_tags at
                INNER JOIN tags t ON t.id = at.tag_id
                WHERE at.article_id = a.id
              ),
              ''
            ) AS tag_names,
            COALESCE(a.journalist_name, j.full_name, u.username, 'Nha bao') AS journalist_name
          FROM articles a
          LEFT JOIN users u ON u.id = a.journalist_id
          LEFT JOIN journalists j ON j.user_id = a.journalist_id
          WHERE a.status = 'published' AND a.category_id = ?
          ORDER BY datetime(COALESCE(a.published_at, a.updated_at, a.created_at)) DESC
          LIMIT ?
        `,
        [category.name, category.id, perCategoryLimit],
      );

      sections.push({
        id: category.id,
        name: category.name,
        items: rows.map(mapNewsRow),
      });
    }

    res.json({ sections });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai tin theo chuyen muc.", detail: error.message });
  }
});

app.get("/api/news/personalized", async (req, res) => {
  try {
    const db = await getDb();
    const userId = normalizeText(req.query.userId);
    const safeLimit = normalizeLimit(req.query.limit, 8);
    if (!userId) {
      return res.json({ items: [] });
    }

    const rows = await db.all(
      `
        WITH favorite_categories AS (
          SELECT
            a.category_id,
            COUNT(*) AS score
          FROM user_reading_history h
          INNER JOIN articles a ON a.id = h.article_id
          WHERE h.user_id = ?
          GROUP BY a.category_id
          ORDER BY score DESC
          LIMIT 3
        ),
        favorite_tags AS (
          SELECT
            at.tag_id,
            COUNT(*) AS score
          FROM user_reading_history h
          INNER JOIN article_tags at ON at.article_id = h.article_id
          WHERE h.user_id = ?
          GROUP BY at.tag_id
          ORDER BY score DESC
          LIMIT 5
        )
        SELECT DISTINCT
          a.id,
          a.title,
          a.slug,
          a.summary,
          a.content,
          a.content_html,
          a.thumbnail_url,
          a.status,
          a.view_count,
          a.published_at,
          a.updated_at,
          a.created_at,
          a.category_id,
          c.name AS category_name,
          COALESCE(
            (
              SELECT GROUP_CONCAT(t.name, '||')
              FROM article_tags at2
              INNER JOIN tags t ON t.id = at2.tag_id
              WHERE at2.article_id = a.id
            ),
            ''
          ) AS tag_names,
          COALESCE(a.journalist_name, j.full_name, u.username, 'Nha bao') AS journalist_name
        FROM articles a
        LEFT JOIN categories c ON c.id = a.category_id
        LEFT JOIN users u ON u.id = a.journalist_id
        LEFT JOIN journalists j ON j.user_id = a.journalist_id
        LEFT JOIN article_tags at ON at.article_id = a.id
        WHERE a.status = 'published'
          AND (
            a.category_id IN (SELECT category_id FROM favorite_categories)
            OR at.tag_id IN (SELECT tag_id FROM favorite_tags)
          )
        ORDER BY
          CASE
            WHEN a.category_id IN (SELECT category_id FROM favorite_categories)
            THEN 1
            ELSE 0
          END DESC,
          a.view_count DESC,
          datetime(COALESCE(a.published_at, a.updated_at, a.created_at)) DESC
        LIMIT ?
      `,
      [userId, userId, safeLimit],
    );

    res.json({ items: rows.map(mapNewsRow) });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai tin ca nhan hoa.", detail: error.message });
  }
});

app.get("/api/news/by-tag", async (req, res) => {
  try {
    const db = await getDb();
    const cleanTag = normalizeText(req.query.tag).replace(/^#/, "");
    const safeLimit = normalizeLimit(req.query.limit, 20);
    if (!cleanTag) {
      return res.json({ items: [] });
    }

    const rows = await db.all(
      `
        SELECT
          a.id,
          a.title,
          a.slug,
          a.summary,
          a.content,
          a.content_html,
          a.thumbnail_url,
          a.status,
          a.view_count,
          a.published_at,
          a.updated_at,
          a.created_at,
          a.category_id,
          c.name AS category_name,
          COALESCE(
            (
              SELECT GROUP_CONCAT(t2.name, '||')
              FROM article_tags at2
              INNER JOIN tags t2 ON t2.id = at2.tag_id
              WHERE at2.article_id = a.id
            ),
            ''
          ) AS tag_names,
          COALESCE(a.journalist_name, j.full_name, u.username, 'Nha bao') AS journalist_name
        FROM articles a
        INNER JOIN article_tags at ON at.article_id = a.id
        INNER JOIN tags t ON t.id = at.tag_id
        LEFT JOIN categories c ON c.id = a.category_id
        LEFT JOIN users u ON u.id = a.journalist_id
        LEFT JOIN journalists j ON j.user_id = a.journalist_id
        WHERE a.status = 'published' AND t.name = ? COLLATE NOCASE
        ORDER BY a.view_count DESC,
                 datetime(COALESCE(a.published_at, a.updated_at, a.created_at)) DESC
        LIMIT ?
      `,
      [cleanTag, safeLimit],
    );

    res.json({ items: rows.map(mapNewsRow) });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai tin theo tag.", detail: error.message });
  }
});

app.post("/api/news/:articleId/view", async (req, res) => {
  try {
    const db = await getDb();
    const articleId = normalizeText(req.params.articleId);
    if (!articleId) {
      return res.status(400).json({ message: "Thieu articleId." });
    }

    await db.run(
      `
        UPDATE articles
        SET view_count = COALESCE(view_count, 0) + 1,
            updated_at = ?
        WHERE id = ?
      `,
      [nowIso(), articleId],
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Khong the tang luot xem.", detail: error.message });
  }
});

app.post("/api/news/:articleId/read", async (req, res) => {
  try {
    const db = await getDb();
    const articleId = normalizeText(req.params.articleId);
    const userId = normalizeText(req.body?.userId);
    if (!articleId || !userId) {
      return res.status(400).json({ message: "Thieu thong tin doc bai." });
    }

    await db.run(
      `
        INSERT INTO user_reading_history (id, user_id, article_id, viewed_at)
        VALUES (?, ?, ?, ?)
      `,
      [makeId("read"), userId, articleId, nowIso()],
    );

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Khong the luu lich su doc.", detail: error.message });
  }
});

app.get("/api/comments", async (req, res) => {
  try {
    const db = await getDb();
    const articleId = normalizeText(req.query.articleId);
    if (!articleId) {
      return res.status(400).json({ message: "Thieu articleId." });
    }

    const items = await db.all(
      `
        SELECT
          c.id,
          c.article_id,
          c.user_id,
          c.parent_id,
          c.content,
          c.is_approved,
          c.created_at,
          COALESCE(j.full_name, u.username, c.user_id) AS author_name,
          COALESCE(u.role, 'user') AS author_role
        FROM comments c
        LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN journalists j ON j.user_id = u.id
        WHERE c.article_id = ? AND c.is_approved = 1
        ORDER BY datetime(c.created_at) ASC
      `,
      [articleId],
    );

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: "Khong the tai binh luan.", detail: error.message });
  }
});

app.post("/api/comments", async (req, res) => {
  try {
    const db = await getDb();
    const articleId = normalizeText(req.body?.articleId);
    const userId = normalizeText(req.body?.userId);
    const content = normalizeText(req.body?.content);
    const parentId = normalizeText(req.body?.parentId) || null;

    if (!articleId || !userId) {
      return res.status(400).json({ message: "Thieu thong tin binh luan." });
    }
    if (!content) {
      return res.status(400).json({ message: "Noi dung binh luan khong duoc de trong." });
    }

    const existingUser = await db.get("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
    if (!existingUser) {
      await db.run(
        `
          INSERT INTO users (id, username, email, role, is_active, created_at)
          VALUES (?, ?, NULL, 'user', 1, ?)
        `,
        [userId, userId.slice(0, 18), nowIso()],
      );
    }

    await db.run(
      `
        INSERT INTO comments (
          id,
          article_id,
          user_id,
          parent_id,
          content,
          is_approved,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `,
      [makeId("cmt"), articleId, userId, parentId, content, nowIso()],
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Khong the tao binh luan.", detail: error.message });
  }
});

app.post("/api/word/convert", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Missing file field." });
    }

    const mime = req.file.mimetype || "";
    const name = req.file.originalname || "";
    const isDocx =
      mime.includes("wordprocessingml.document") ||
      name.toLowerCase().endsWith(".docx");

    if (!isDocx) {
      return res.status(400).json({
        message:
          "Only .docx is supported for rich conversion. Please upload a .docx file.",
      });
    }

    const result = await mammoth.convertToHtml(
      { buffer: req.file.buffer },
      {
        convertImage: mammoth.images.inline(async (image) => {
          const base64 = await image.read("base64");
          return {
            src: `data:${image.contentType};base64,${base64}`,
          };
        }),
      },
    );

    const rawText = (result.value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const title = rawText.split(" ").slice(0, 12).join(" ").trim();

    return res.json({
      html: result.value || "",
      plainText: rawText,
      suggestedTitle: title || req.file.originalname.replace(/\.docx$/i, ""),
      warnings: result.messages || [],
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to convert Word document.",
      detail: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`news-server listening on http://localhost:${PORT}`);
  console.log(`using local SQLite at: ${DB_PATH}`);
});
