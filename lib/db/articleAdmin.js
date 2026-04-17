import { getDb } from "./core";

export async function getArticles({ status = 'all' } = {}) {
  const db = await getDb();
  let where = '';
  if (status === 'pending') where = "WHERE a.status = 'draft' OR a.status = 'pending'";
  else if (status === 'approved') where = "WHERE a.status = 'published'";
  else if (status === 'rejected') where = "WHERE a.status = 'archived'";
  return await db.getAllAsync(
    `SELECT a.id, a.title, a.summary, a.status, a.created_at, a.thumbnail_url, a.category_id, c.name as category_name, u.username as author, a.published_at, a.updated_at
     FROM articles a
     LEFT JOIN users u ON u.id = a.journalist_id
     LEFT JOIN categories c ON c.id = a.category_id
     ${where}
     ORDER BY datetime(a.created_at) DESC`
  );
}

export async function approveArticle(articleId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE articles SET status = 'published', published_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [articleId]
  );
}

export async function rejectArticle(articleId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE articles SET status = 'archived' WHERE id = ?`,
    [articleId]
  );
}
