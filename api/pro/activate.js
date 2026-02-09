const {
  json,
  badRequest,
  methodNotAllowed,
  normalizeEmail,
  isValidEmail,
  sha256Hex,
  randomToken,
  getStorageMode,
  kvGetJson,
  kvSetJson
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

    const email = normalizeEmail(payload.email);
    const deviceId = String(payload.device_id || "").trim();

    if (!email || !isValidEmail(email)) return badRequest(res, "Invalid email", "INVALID_EMAIL");
    if (!deviceId || deviceId.length < 8) return badRequest(res, "Invalid device_id", "INVALID_DEVICE");

    const emailHash = sha256Hex(email);
    const licenseKey = `license:${emailHash}`;

    try {
    const licenseRes = await kvGetJson(licenseKey);
      if (!licenseRes.ok) {
        return json(res, 503, { code: licenseRes.reason, message: "Storage unavailable" });
      }

      const license = licenseRes.value;
      if (!license || license.status !== "active") {
        return json(res, 403, {
          code: "NOT_PURCHASED",
          message: "Not activated yet."
        });
      }

      const devices = Array.isArray(license.devices) ? license.devices : [];
      const alreadyBound = devices.includes(deviceId);
      if (!alreadyBound && devices.length >= 2) {
        return json(res, 403, {
          code: "DEVICE_LIMIT_REACHED",
          message: "Device limit reached (2 devices). Contact support to reset."
        });
      }

      const nextDevices = alreadyBound ? devices : [...devices, deviceId];
      await kvSetJson(licenseKey, {
        ...license,
        devices: nextDevices,
        updatedAt: new Date().toISOString()
      });

      const token = randomToken();
      await kvSetJson(`token:${token}`, {
        email_hash: emailHash,
        device_id: deviceId,
        issuedAt: new Date().toISOString()
      });

      return json(res, 200, { pro: true, token });
    } catch (e) {
      return json(res, 500, { code: "INTERNAL_ERROR", message: e.message || "Internal error" });
    }
  });
};
