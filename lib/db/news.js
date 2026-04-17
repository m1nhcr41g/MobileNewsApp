import { getDb, normalizeLimit, normalizeText, nowIso, makeId } from "./core";
import { isCentralDbEnabled, requestCentralJson } from "./remote";

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

async function getPublishedNewsBase(limit, orderByClause) {
  const db = await getDb();
  const safeLimit = normalizeLimit(limit, 8);
  const rows = await db.getAllAsync(
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
        COALESCE(j.full_name, u.username) AS journalist_name
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

export async function getLatestNews(limit = 8) {
  if (isCentralDbEnabled()) {
    const data = await requestCentralJson("/api/news/latest", {}, { limit });
    return Array.isArray(data?.items) ? data.items : [];
  }

  return await getPublishedNewsBase(
    limit,
    "datetime(COALESCE(a.published_at, a.updated_at, a.created_at)) DESC",
  );
}

export async function getHotNews(limit = 8) {
  if (isCentralDbEnabled()) {
    const data = await requestCentralJson("/api/news/hot", {}, { limit });
    return Array.isArray(data?.items) ? data.items : [];
  }

  return await getPublishedNewsBase(
    limit,
    "a.view_count DESC, datetime(COALESCE(a.published_at, a.updated_at, a.created_at)) DESC",
  );
}

export async function getNewsByCategories(options = {}) {
  if (isCentralDbEnabled()) {
    const data = await requestCentralJson("/api/news/by-categories", {}, {
      maxCategories: options.maxCategories,
      perCategoryLimit: options.perCategoryLimit,
    });
    return Array.isArray(data?.sections) ? data.sections : [];
  }

  const db = await getDb();
  const maxCategories = normalizeLimit(options.maxCategories, 4);
  const perCategoryLimit = normalizeLimit(options.perCategoryLimit, 5);

  const categories = await db.getAllAsync(
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
    const rows = await db.getAllAsync(
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
          COALESCE(j.full_name, u.username) AS journalist_name
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

  return sections;
}

export async function incrementArticleViewCount(articleId) {
  if (isCentralDbEnabled()) {
    const cleanId = normalizeText(articleId);
    if (!cleanId) return;
    await requestCentralJson(`/api/news/${encodeURIComponent(cleanId)}/view`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    return;
  }

  const db = await getDb();
  const cleanId = normalizeText(articleId);
  if (!cleanId) return;

  await db.runAsync(
    `
      UPDATE articles
      SET view_count = COALESCE(view_count, 0) + 1,
          updated_at = ?
      WHERE id = ?
    `,
    [nowIso(), cleanId],
  );
}

export async function recordUserRead(userId, articleId) {
  if (isCentralDbEnabled()) {
    const cleanUserId = normalizeText(userId);
    const cleanArticleId = normalizeText(articleId);
    if (!cleanUserId || !cleanArticleId) return;
    await requestCentralJson(`/api/news/${encodeURIComponent(cleanArticleId)}/read`, {
      method: "POST",
      body: JSON.stringify({ userId: cleanUserId }),
    });
    return;
  }

  const db = await getDb();
  const cleanUserId = normalizeText(userId);
  const cleanArticleId = normalizeText(articleId);
  if (!cleanUserId || !cleanArticleId) return;

  await db.runAsync(
    `
      INSERT INTO user_reading_history (id, user_id, article_id, viewed_at)
      VALUES (?, ?, ?, ?)
    `,
    [makeId("read"), cleanUserId, cleanArticleId, nowIso()],
  );
}

export async function getPersonalizedNews(userId, limit = 8) {
  if (isCentralDbEnabled()) {
    const cleanUserId = normalizeText(userId);
    if (!cleanUserId) return [];
    const data = await requestCentralJson("/api/news/personalized", {}, {
      userId: cleanUserId,
      limit,
    });
    return Array.isArray(data?.items) ? data.items : [];
  }

  const db = await getDb();
  const cleanUserId = normalizeText(userId);
  const safeLimit = normalizeLimit(limit, 8);
  if (!cleanUserId) return [];

  const rows = await db.getAllAsync(
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
        COALESCE(j.full_name, u.username) AS journalist_name
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
    [cleanUserId, cleanUserId, safeLimit],
  );

  return rows.map(mapNewsRow);
}

export async function getPublishedNewsByTag(tagName, limit = 20) {
  if (isCentralDbEnabled()) {
    const cleanTag = normalizeText(tagName).replace(/^#/, "");
    if (!cleanTag) return [];
    const data = await requestCentralJson("/api/news/by-tag", {}, {
      tag: cleanTag,
      limit,
    });
    return Array.isArray(data?.items) ? data.items : [];
  }

  const db = await getDb();
  const cleanTag = normalizeText(tagName).replace(/^#/, "");
  const safeLimit = normalizeLimit(limit, 20);
  if (!cleanTag) return [];

  const rows = await db.getAllAsync(
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
        COALESCE(j.full_name, u.username) AS journalist_name
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

  return rows.map(mapNewsRow);
}
