import { getDb, makeId, normalizeText, nowIso } from "./core";
import { isCentralDbEnabled, requestCentralJson } from "./remote";

export async function getArticleComments(articleId) {
  if (isCentralDbEnabled()) {
    const cleanArticleId = normalizeText(articleId);
    if (!cleanArticleId) return [];
    const data = await requestCentralJson("/api/comments", {}, { articleId: cleanArticleId });
    return Array.isArray(data?.items) ? data.items : [];
  }

  const db = await getDb();
  const cleanArticleId = normalizeText(articleId);
  if (!cleanArticleId) return [];

  return await db.getAllAsync(
    `
      SELECT
        c.id,
        c.article_id,
        c.user_id,
        c.parent_id,
        c.content,
        c.is_approved,
        c.created_at,
        COALESCE(j.full_name, u.username) AS author_name,
        u.role AS author_role
      FROM comments c
      INNER JOIN users u ON u.id = c.user_id
      LEFT JOIN journalists j ON j.user_id = u.id
      WHERE c.article_id = ? AND c.is_approved = 1
      ORDER BY datetime(c.created_at) ASC
    `,
    [cleanArticleId],
  );
}

export async function createArticleComment({
  articleId,
  userId,
  content,
  parentId = null,
}) {
  if (isCentralDbEnabled()) {
    const cleanArticleId = normalizeText(articleId);
    const cleanUserId = normalizeText(userId);
    const cleanContent = normalizeText(content);
    if (!cleanArticleId || !cleanUserId) {
      throw new Error("Thiếu thông tin bình luận.");
    }
    if (!cleanContent) {
      throw new Error("Nội dung bình luận không được để trống.");
    }

    await requestCentralJson("/api/comments", {
      method: "POST",
      body: JSON.stringify({
        articleId: cleanArticleId,
        userId: cleanUserId,
        content: cleanContent,
        parentId: normalizeText(parentId) || null,
      }),
    });
    return;
  }

  const db = await getDb();
  const cleanArticleId = normalizeText(articleId);
  const cleanUserId = normalizeText(userId);
  const cleanContent = normalizeText(content);

  if (!cleanArticleId || !cleanUserId) {
    throw new Error("Thiếu thông tin bình luận.");
  }
  if (!cleanContent) {
    throw new Error("Nội dung bình luận không được để trống.");
  }

  await db.runAsync(
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
    [
      makeId("cmt"),
      cleanArticleId,
      cleanUserId,
      normalizeText(parentId) || null,
      cleanContent,
      nowIso(),
    ],
  );
}
