import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";

const DB_NAME = "football_news.db";
const CACHE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS app_cache (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`;

let dbPromise;

async function ensureBundledDatabase() {
  if (Platform.OS === "web") {
    return;
  }

  const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
  const targetPath = `${sqliteDir}/${DB_NAME}`;
  const fileInfo = await FileSystem.getInfoAsync(targetPath);

  if (fileInfo.exists) {
    return;
  }

  await FileSystem.makeDirectoryAsync(sqliteDir, { intermediates: true });
  const dbAsset = Asset.fromModule(require("../../football_news.db"));
  await dbAsset.downloadAsync();

  if (!dbAsset.localUri) {
    throw new Error("Khong the sao chep file SQLite tu assets.");
  }

  await FileSystem.copyAsync({
    from: dbAsset.localUri,
    to: targetPath,
  });
}

export async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      await ensureBundledDatabase();
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(CACHE_TABLE_SQL);
      return db;
    })();
  }

  return dbPromise;
}

export function makeId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function normalizeText(value) {
  return (value || "").trim().normalize("NFC");
}

export function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

export function normalizeLimit(limit, fallbackValue) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) return fallbackValue;
  return Math.floor(value);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
