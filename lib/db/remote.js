import { CENTRAL_API_URL } from "@env";

function normalizeBaseUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  return value.replace(/\/+$/, "");
}

const BASE_URL = normalizeBaseUrl(CENTRAL_API_URL);

export function isCentralDbEnabled() {
  return Boolean(BASE_URL);
}

export function buildCentralUrl(pathname, query = {}) {
  if (!BASE_URL) {
    throw new Error("CENTRAL_API_URL chưa được cấu hình.");
  }

  const path = String(pathname || "").startsWith("/")
    ? String(pathname)
    : `/${String(pathname || "")}`;

  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.append(key, String(value));
  });

  const qs = params.toString();
  return `${BASE_URL}${path}${qs ? `?${qs}` : ""}`;
}

export async function requestCentralJson(pathname, options = {}, query = {}) {
  const url = buildCentralUrl(pathname, query);
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || `Yêu cầu thất bại (${response.status}).`);
  }

  return data;
}
