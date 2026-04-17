import { getDb, makeId, normalizeText, nowIso } from "./core";
import { isCentralDbEnabled, requestCentralJson } from "./remote";

function slugify(title) {
  return normalizeText(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function ensureDefaultCategory() {
  const db = await getDb();
  const existing = await db.getFirstAsync(
    "SELECT id FROM categories ORDER BY name LIMIT 1",
  );

  if (existing?.id) {
    return existing.id;
  }

  const categoryId = makeId("cat");
  await db.runAsync(
    `
      INSERT INTO categories (id, name, slug, description)
      VALUES (?, 'Tin tong hop', 'tin-tong-hop', 'Danh muc mac dinh')
    `,
    [categoryId],
  );

  return categoryId;
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

async function ensureTagByName(tagName) {
  const db = await getDb();
  const cleanName = normalizeTagName(tagName);

  if (!cleanName) {
    return null;
  }

  const existing = await db.getFirstAsync(
    "SELECT id FROM tags WHERE name = ? COLLATE NOCASE LIMIT 1",
    [cleanName],
  );

  if (existing?.id) {
    return existing.id;
  }

  const tagId = makeId("tag");
  const slugBase = makeTagSlug(cleanName) || `tag-${Date.now()}`;
  const slug = `${slugBase}-${Date.now()}`;
  await db.runAsync("INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)", [
    tagId,
    cleanName,
    slug,
  ]);
  return tagId;
}

async function syncArticleTags(articleId, tagsInput) {
  const db = await getDb();
  const cleanArticleId = normalizeText(articleId);
  const names = Array.isArray(tagsInput)
    ? tagsInput.map((item) => normalizeTagName(item)).filter(Boolean)
    : [];

  const uniqueNames = [...new Set(names.map((item) => item.toLowerCase()))];
  const normalizedByLower = {};
  names.forEach((item) => {
    normalizedByLower[item.toLowerCase()] = item;
  });

  await db.runAsync("DELETE FROM article_tags WHERE article_id = ?", [
    cleanArticleId,
  ]);

  for (const lowered of uniqueNames) {
    const tagId = await ensureTagByName(normalizedByLower[lowered]);
    if (!tagId) continue;
    await db.runAsync(
      "INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)",
      [cleanArticleId, tagId],
    );
  }
}

async function replaceArticleAttachments(articleId, attachmentsInput) {
  const db = await getDb();
  const cleanArticleId = normalizeText(articleId);
  const attachments = Array.isArray(attachmentsInput) ? attachmentsInput : [];

  await db.runAsync("DELETE FROM article_attachments WHERE article_id = ?", [
    cleanArticleId,
  ]);

  for (const file of attachments) {
    const fileName = normalizeText(file?.fileName || file?.name);
    if (!fileName) continue;

    await db.runAsync(
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

export async function getArticleAttachments(articleId) {
  if (isCentralDbEnabled()) {
    const cleanArticleId = normalizeText(articleId);
    if (!cleanArticleId) return [];
    const data = await requestCentralJson("/api/journalist/attachments", {}, {
      articleId: cleanArticleId,
    });
    return Array.isArray(data?.items) ? data.items : [];
  }

  const db = await getDb();
  const cleanArticleId = normalizeText(articleId);
  if (!cleanArticleId) return [];

  return await db.getAllAsync(
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
    [cleanArticleId],
  );
}

export async function getCategories() {
  if (isCentralDbEnabled()) {
    const data = await requestCentralJson("/api/categories");
    return Array.isArray(data?.items) ? data.items : [];
  }

  const db = await getDb();
  return await db.getAllAsync(
    "SELECT id, name, slug, description FROM categories ORDER BY name ASC",
  );
}

export async function getTags() {
  if (isCentralDbEnabled()) {
    const data = await requestCentralJson("/api/tags");
    return Array.isArray(data?.items) ? data.items : [];
  }

  const db = await getDb();
  return await db.getAllAsync("SELECT id, name, slug FROM tags ORDER BY name ASC");
}

export async function getJournalistArticles(userId) {
  if (isCentralDbEnabled()) {
    const cleanUserId = normalizeText(userId);
    if (!cleanUserId) return [];
    const data = await requestCentralJson("/api/journalist/articles", {}, {
      journalistId: cleanUserId,
    });
    return Array.isArray(data?.items) ? data.items : [];
  }

  const db = await getDb();
  const cleanUserId = normalizeText(userId);

  if (!cleanUserId) {
    return [];
  }

  return await db.getAllAsync(
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
    [cleanUserId],
  );
}

function stripHtml(value) {
return normalizeText(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

export async function createJournalistArticle(userId, payload) {
  if (isCentralDbEnabled()) {
    const cleanUserId = normalizeText(userId);
    if (!cleanUserId) {
      throw new Error("Không xác định được nhà báo.");
    }

    const data = await requestCentralJson("/api/journalist/articles", {
      method: "POST",
      body: JSON.stringify({ journalistId: cleanUserId, ...payload }),
    });
    return data?.id;
  }

  const db = await getDb();
  const cleanUserId = normalizeText(userId);

  if (!cleanUserId) {
    throw new Error("Không xác định được nhà báo.");
  }

  const title = normalizeText(payload?.title);
  const summary = normalizeText(payload?.summary);
  const contentHtml = normalizeText(payload?.contentHtml);
  const plainContent = normalizeText(
    payload?.contentPlain || stripHtml(contentHtml || payload?.content),
  );
  const thumbnailUrl = normalizeText(payload?.thumbnailUrl) || null;
  const status = normalizeText(payload?.status) || "draft";

  if (!title || !summary || !plainContent) {
    throw new Error("Tiêu đề, tóm tắt và nội dung là bắt buộc.");
  }

  const allowedStatuses = ["draft", "published", "archived"];
  if (!allowedStatuses.includes(status)) {
    throw new Error("Trạng thái bài viết không hợp lệ.");
  }

  const articleId = makeId("art");
  const now = nowIso();
  const publishedAt = status === "published" ? now : null;
  const categoryId = normalizeText(payload?.categoryId) || (await ensureDefaultCategory());
  const slugBase = slugify(title) || `bai-viet-${Date.now()}`;
  const slug = `${slugBase}-${Date.now()}`;

  await db.runAsync(
    `
      INSERT INTO articles (
        id,
        journalist_id,
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `,
    [
      articleId,
      cleanUserId,
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

  await syncArticleTags(articleId, payload?.tags);
  await replaceArticleAttachments(articleId, payload?.attachments);

  return articleId;
}

export async function updateJournalistArticle(userId, articleId, payload) {
  if (isCentralDbEnabled()) {
    const cleanUserId = normalizeText(userId);
    const cleanArticleId = normalizeText(articleId);
    if (!cleanUserId || !cleanArticleId) {
      throw new Error("Thiếu thông tin cập nhật bài viết.");
    }

    await requestCentralJson(`/api/journalist/articles/${encodeURIComponent(cleanArticleId)}`, {
      method: "PUT",
      body: JSON.stringify({ journalistId: cleanUserId, ...payload }),
    });
    return;
  }

  const db = await getDb();
  const cleanUserId = normalizeText(userId);
  const cleanArticleId = normalizeText(articleId);

  if (!cleanUserId || !cleanArticleId) {
    throw new Error("Thiếu thông tin cập nhật bài viết.");
  }

  const existing = await db.getFirstAsync(
    "SELECT id, status FROM articles WHERE id = ? AND journalist_id = ? LIMIT 1",
    [cleanArticleId, cleanUserId],
  );

  if (!existing) {
    throw new Error("Không tìm thấy bài viết.");
  }

  const title = normalizeText(payload?.title);
  const content = normalizeText(payload?.content);
  const thumbnailUrl = normalizeText(payload?.thumbnailUrl) || null;
  const status = normalizeText(payload?.status) || existing.status || "draft";
  const categoryId = normalizeText(payload?.categoryId) || (await ensureDefaultCategory());
  const summary = normalizeText(payload?.summary);
  const contentHtml = normalizeText(payload?.contentHtml);
  const plainContent = normalizeText(payload?.contentPlain || stripHtml(contentHtml || payload?.content));
  if (!title ||!summary||!plainContent) {
    throw new Error("Không được bỏ ô trống.");
  }

  const allowedStatuses = ["draft", "published", "archived"];
  if (!allowedStatuses.includes(status)) {
    throw new Error("Trạng thái bài viết không hợp lệ.");
  }

  const now = nowIso();
  const shouldSetPublishedAt = status === "published";
  const newSlug = `${slugify(title) || `bai-viet-${Date.now()}`}-${Date.now()}`;

  await db.runAsync(
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
      contentHtml,
      thumbnailUrl,
      status,
      status,
      shouldSetPublishedAt ? now : null,
      status,
      now,
      cleanArticleId,
      cleanUserId,
    ],
  );

  await syncArticleTags(cleanArticleId, payload?.tags);
  await replaceArticleAttachments(cleanArticleId, payload?.attachments);
}

export async function deleteJournalistArticle(userId, articleId) {
  if (isCentralDbEnabled()) {
    const cleanUserId = normalizeText(userId);
    const cleanArticleId = normalizeText(articleId);
    if (!cleanUserId || !cleanArticleId) {
      throw new Error("Thiếu thông tin xóa bài viết.");
    }

    await requestCentralJson(`/api/journalist/articles/${encodeURIComponent(cleanArticleId)}`, {
      method: "DELETE",
      body: JSON.stringify({ journalistId: cleanUserId }),
    });
    return;
  }

  const db = await getDb();
  const cleanUserId = normalizeText(userId);
  const cleanArticleId = normalizeText(articleId);

  if (!cleanUserId || !cleanArticleId) {
    throw new Error("Thiếu thông tin xóa bài viết.");
  }

  await db.runAsync("DELETE FROM article_tags WHERE article_id = ?", [cleanArticleId]);
  await db.runAsync("DELETE FROM article_attachments WHERE article_id = ?", [cleanArticleId]);
  await db.runAsync("DELETE FROM comments WHERE article_id = ?", [cleanArticleId]);
  await db.runAsync(
    "DELETE FROM articles WHERE id = ? AND journalist_id = ?",
    [cleanArticleId, cleanUserId],
  );
}

export async function changeJournalistArticleStatus(userId, articleId, status) {
  if (isCentralDbEnabled()) {
    const cleanUserId = normalizeText(userId);
    const cleanArticleId = normalizeText(articleId);
    const cleanStatus = normalizeText(status);
    const allowedStatuses = ["draft", "published", "archived"];
    if (!allowedStatuses.includes(cleanStatus)) {
      throw new Error("Trạng thái bài viết không hợp lệ.");
    }

    await requestCentralJson(
      `/api/journalist/articles/${encodeURIComponent(cleanArticleId)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ journalistId: cleanUserId, status: cleanStatus }),
      },
    );
    return;
  }

  const db = await getDb();
  const cleanUserId = normalizeText(userId);
  const cleanArticleId = normalizeText(articleId);
  const cleanStatus = normalizeText(status);

  const allowedStatuses = ["draft", "published", "archived"];
  if (!allowedStatuses.includes(cleanStatus)) {
    throw new Error("Trạng thái bài viết không hợp lệ.");
  }

  const now = nowIso();

  await db.runAsync(
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
    [
      cleanStatus,
      cleanStatus,
      cleanStatus === "published" ? now : null,
      cleanStatus,
      now,
      cleanArticleId,
      cleanUserId,
    ],
  );
}
