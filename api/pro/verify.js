const {
  json,
  badRequest,
  methodNotAllowed,
  getStorageMode,
  kvGetJson
} = require("./_util");

module.exports = async (req, res) => {
  if (req.method !== "POST") return methodNotAllowed(res);

  if (getStorageMode() === "none") {
    return json(res, 503, {
      code: "KV_NOT_CONFIGURED",
      message: "KV is not configured yet. Please try again later."
    });
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", async () => {
    let payload;
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      return badRequest(res, "Invalid JSON body");
    }

    const token = String(payload.token || "").trim();
    const deviceId = String(payload.device_id || "").trim();
    if (!token) return badRequest(res, "Missing token", "MISSING_TOKEN");
    if (!deviceId) return badRequest(res, "Missing device_id", "MISSING_DEVICE");

    try {
      const tokenRes = await kvGetJson(`token:${token}`);
      if (!tokenRes.ok) {
        return json(res, 503, { code: tokenRes.reason, message: "Storage unavailable" });
      }
      const record = tokenRes.value;
      const ok = !!record && record.device_id === deviceId;
      return json(res, 200, { pro: ok });
    } catch (e) {
      return json(res, 500, { code: "INTERNAL_ERROR", message: e.message || "Internal error" });
    }
  });
};
