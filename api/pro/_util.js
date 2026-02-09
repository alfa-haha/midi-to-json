const crypto = require("crypto");

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function badRequest(res, message, code = "BAD_REQUEST") {
  return json(res, 400, { code, message });
}

function methodNotAllowed(res) {
  res.statusCode = 405;
  res.setHeader("Allow", "POST");
  res.end("Method Not Allowed");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hasKvEnv() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getStorageMode() {
  if (hasKvEnv()) return "kv";
  if (process.env.PRO_FALLBACK_STORAGE === "memory") return "memory";
  return "none";
}

function getMemoryStore() {
  if (!globalThis.__MIDIEASY_PRO_MEMORY_STORE) {
    globalThis.__MIDIEASY_PRO_MEMORY_STORE = new Map();
  }
  return globalThis.__MIDIEASY_PRO_MEMORY_STORE;
}

async function getKv() {
  // Lazy import to avoid crashing local dev when KV isn't configured yet.
  const { kv } = await import("@vercel/kv");
  return kv;
}

async function kvGetJson(key) {
  const mode = getStorageMode();
  if (mode === "none") return { ok: false, reason: "KV_NOT_CONFIGURED" };

  let value;
  if (mode === "memory") {
    value = getMemoryStore().get(key);
  } else {
    const kv = await getKv();
    value = await kv.get(key);
  }

  if (!value) return { ok: true, value: null };
  if (typeof value === "string") {
    try {
      return { ok: true, value: JSON.parse(value) };
    } catch {
      return { ok: true, value };
    }
  }
  return { ok: true, value };
}

async function kvSetJson(key, value) {
  const mode = getStorageMode();
  if (mode === "none") return { ok: false, reason: "KV_NOT_CONFIGURED" };

  if (mode === "memory") {
    getMemoryStore().set(key, value);
    return { ok: true };
  }

  const kv = await getKv();
  await kv.set(key, value);
  return { ok: true };
}

module.exports = {
  json,
  badRequest,
  methodNotAllowed,
  normalizeEmail,
  isValidEmail,
  sha256Hex,
  randomToken,
  hasKvEnv,
  getStorageMode,
  kvGetJson,
  kvSetJson
};
