import { getDb } from "./core";

export async function getUsers({ search = "", role = "all" } = {}) {
  const db = await getDb();
  let where = "WHERE 1=1";
  if (search) where += ` AND (username LIKE '%${search}%' OR email LIKE '%${search}%')`;
  if (role !== "all") where += ` AND role = '${role}'`;
  return await db.getAllAsync(
    `SELECT id, username, email, role FROM users ${where} ORDER BY username ASC`
  );
}

export async function deleteUser(userId) {
  const db = await getDb();
  await db.runAsync("DELETE FROM users WHERE id = ?", [userId]);
}



export async function changeUserRole(userId, newRole) {
  const db = await getDb();
  await db.runAsync("UPDATE users SET role = ? WHERE id = ?", [newRole, userId]);
}