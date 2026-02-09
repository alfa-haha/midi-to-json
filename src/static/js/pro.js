(() => {
  const STORAGE_KEYS = {
    deviceId: "midieasy_device_id",
    token: "midieasy_pro_token",
    lastVerifyAt: "midieasy_pro_last_verify_at",
    activatedEmail: "midieasy_pro_email",
    panelMode: "midieasy_pro_panel_mode", // "expanded" | "collapsed"
    hasConverted: "midieasy_has_converted" // "1"
  };

  let proCopy = null;
  let proCopyLoadedAt = 0;
  let lastBenefitsRenderKey = "";
  let inlinePanelCopy = null;

  function getActiveLang() {
    const raw = String(document.documentElement?.getAttribute("lang") || "").trim().toLowerCase();
    if (raw === "zh" || raw.startsWith("zh-")) return "zh";
    if (raw === "de" || raw.startsWith("de-")) return "de";
    return "en";
  }

  function readInlinePanelCopy() {
    const el = document.getElementById("midieasy-pro-panel-copy");
    if (!el) return null;
    const raw = String(el.textContent || "").trim();
    if (!raw) return null;
    try {
      const json = JSON.parse(raw);
      if (!json || typeof json !== "object") return null;
      return json;
    } catch {
      return null;
    }
  }

  function detectToolId() {
    const fromData = String(document.body?.dataset?.tool || "").trim();
    if (fromData) return fromData;

    const p = String(globalThis.location?.pathname || "/");
    if (p.includes("/midi-to-csv")) return "midi-to-csv";
    if (p.includes("/midi-inspector")) return "midi-inspector";
    if (isProLandingPage(p)) return "";

    // Legacy MIDI → JSON pages (/, /zh/, /en/, /de/ + index.html variants)
    if (p === "/" || p.endsWith("/index.html")) return "midi-to-json";
    if (p.startsWith("/zh/") || p.startsWith("/de/") || p.startsWith("/en/")) return "midi-to-json";

    return "";
  }

  async function loadProCopy() {
    const now = Date.now();
    if (proCopy && now - proCopyLoadedAt < 5 * 60 * 1000) return proCopy;
    const res = await fetch("/pro-copy.json", { cache: "force-cache" });
    if (!res.ok) throw new Error(`Failed to load pro-copy.json (${res.status})`);
    const json = await res.json();
    proCopy = json;
    proCopyLoadedAt = now;
    return proCopy;
  }

  function isProLandingPage(pathname) {
    const p = String(pathname || "/");
    return (
      p === "/pro/" || p.startsWith("/pro/") ||
      p === "/zh/pro/" || p.startsWith("/zh/pro/") ||
      p === "/de/pro/" || p.startsWith("/de/pro/")
    );
  }

  function getStoredPanelMode() {
    return localStorage.getItem(STORAGE_KEYS.panelMode) || "";
  }

  function setStoredPanelMode(mode) {
    if (!mode) {
      localStorage.removeItem(STORAGE_KEYS.panelMode);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.panelMode, mode);
  }

  function getHasConverted() {
    return localStorage.getItem(STORAGE_KEYS.hasConverted) === "1";
  }

  function setHasConverted() {
    localStorage.setItem(STORAGE_KEYS.hasConverted, "1");
  }

  function getInitialPanelExpanded() {
    if (isProLandingPage(globalThis.location?.pathname)) return true;
    const stored = getStoredPanelMode();
    if (stored === "expanded") return true;
    if (stored === "collapsed") return false;
    return getHasConverted();
  }

  function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem(STORAGE_KEYS.deviceId);
    if (deviceId) return deviceId;
    deviceId = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random()}`;
    localStorage.setItem(STORAGE_KEYS.deviceId, deviceId);
    return deviceId;
  }

  function getToken() {
    return localStorage.getItem(STORAGE_KEYS.token) || "";
  }

  function setToken(token) {
    if (!token) return;
    localStorage.setItem(STORAGE_KEYS.token, token);
  }

  function clearToken() {
    localStorage.removeItem(STORAGE_KEYS.token);
  }

  function setLastVerifyAt(ts) {
    localStorage.setItem(STORAGE_KEYS.lastVerifyAt, String(ts));
  }

  function getLastVerifyAt() {
    const raw = localStorage.getItem(STORAGE_KEYS.lastVerifyAt);
    return raw ? Number(raw) : 0;
  }

  function setActivatedEmail(email) {
    if (!email) return;
    localStorage.setItem(STORAGE_KEYS.activatedEmail, email);
  }

  function getActivatedEmail() {
    return localStorage.getItem(STORAGE_KEYS.activatedEmail) || "";
  }

  function clearActivatedEmail() {
    localStorage.removeItem(STORAGE_KEYS.activatedEmail);
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { message: text };
    }
    if (!res.ok) {
      const err = new Error(json.message || `Request failed: ${res.status}`);
      err.code = json.code || "REQUEST_FAILED";
      err.status = res.status;
      throw err;
    }
    return json;
  }

  const proState = {
    isPro: false,
    loading: false,
    activationError: "",
    activationErrorCode: "",
    verifyError: "",
    lastAction: "",
    activatedEmail: getActivatedEmail(),
    panelExpanded: getInitialPanelExpanded()
  };

  let lastAnnounced = { isPro: null, activatedEmail: null };

  function announceProChange({ force } = { force: false }) {
    const isPro = !!proState.isPro;
    const activatedEmail = proState.activatedEmail || "";
    if (!force && lastAnnounced.isPro === isPro && lastAnnounced.activatedEmail === activatedEmail) return;
    lastAnnounced = { isPro, activatedEmail };
    try {
      document.dispatchEvent(new CustomEvent("midieasy:pro-changed", { detail: { isPro, activatedEmail } }));
    } catch {
      // no-op
    }
  }

  function setProState(patch) {
    Object.assign(proState, patch);
    globalThis.proState = proState;
    render();
    announceProChange({ force: false });
  }

  function $(sel) {
    return document.querySelector(sel);
  }

  function renderActivationUi(root, { idleStatusMode } = { idleStatusMode: "default" }) {
    if (!root) return;

    const status = root.querySelector("[data-pro-status]");
    const activateBtn = root.querySelector("[data-pro-activate]");
    const emailInput = root.querySelector("[data-pro-email]");
    const errorBox = root.querySelector("[data-pro-error]");
    const emailHintBox = root.querySelector("[data-pro-email-hint]");
    const activatedAs = root.querySelector("[data-pro-activated-as]");

    const rawEmail = emailInput ? emailInput.value : "";
    const normalizedEmail = normalizeEmail(rawEmail);
    const emailIsValid = !!normalizedEmail && isValidEmail(normalizedEmail);

    const hasActivationError = !!proState.activationError && proState.lastAction === "activate";
    const activationStatusText = (() => {
      if (!hasActivationError) return "";
      if (proState.activationErrorCode === "NOT_PURCHASED") {
        return "❌ Not found: We couldn’t find a Pro purchase for this email. Double-check the email on your Stripe receipt.";
      }
      if (proState.activationErrorCode === "DEVICE_LIMIT_REACHED") {
        return "⚠️ Device limit reached: This Pro license is already active on 2 devices. Contact support to reset: support@midieasy.com";
      }
      return `❌ Activation failed: ${proState.activationError}`;
    })();

    if (status) {
      status.classList.toggle("pro-status--active", proState.isPro && !proState.loading);
      status.classList.toggle("pro-status--failed", hasActivationError && !proState.loading);
      status.classList.toggle("pro-status--loading", proState.loading);

      if (proState.loading) {
        status.textContent = proState.lastAction === "activate" ? "Activating…" : "Checking license…";
        status.style.display = "";
      } else if (proState.isPro) {
        status.textContent = "✅ Activated: Pro unlocked on this device.";
        status.style.display = "";
      } else if (hasActivationError) {
        status.textContent = activationStatusText;
        status.style.display = "";
      } else {
        if (idleStatusMode === "hide") {
          status.textContent = "";
          status.style.display = "none";
        } else {
          status.textContent = "Not activated.";
          status.style.display = "";
        }
      }
    }

    if (errorBox) {
      const showVerifyError = !!proState.verifyError && proState.lastAction === "verify" && !proState.loading;
      errorBox.textContent = showVerifyError ? proState.verifyError : "";
      errorBox.style.display = showVerifyError ? "block" : "none";
    }

    if (emailHintBox) {
      const showHint = !!rawEmail && !emailIsValid && !proState.isPro && !proState.loading;
      emailHintBox.textContent = showHint ? "Please enter a valid email (the one used at checkout)." : "";
      emailHintBox.style.display = showHint ? "block" : "none";
    }

    if (activatedAs) {
      const email = proState.activatedEmail || "";
      activatedAs.textContent = email ? `Activated as ${email}` : "";
      activatedAs.style.display = proState.isPro && email ? "block" : "none";
    }

    if (activateBtn) {
      activateBtn.textContent = proState.isPro ? "Deactivate" : "Activate Pro";
      activateBtn.disabled = proState.loading || (!proState.isPro && !emailIsValid);
    }

    if (emailInput) {
      emailInput.disabled = proState.loading;
      emailInput.readOnly = proState.isPro;
      if (proState.isPro && proState.activatedEmail && emailInput.value !== proState.activatedEmail) {
        emailInput.value = proState.activatedEmail;
      }
    }
  }

  function renderBenefitList(ul, items) {
    if (!ul) return;
    ul.innerHTML = "";
    for (const it of Array.isArray(items) ? items : []) {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = String(it && it.strong ? it.strong : "");
      li.appendChild(strong);
      const detail = String(it && it.detail ? it.detail : "");
      if (detail) {
        li.appendChild(document.createTextNode(" "));
        const span = document.createElement("span");
        span.style.color = "#666";
        span.textContent = detail;
        li.appendChild(span);
      }
      ul.appendChild(li);
    }
  }

  function renderPanelBenefits(root) {
    const inline = inlinePanelCopy && typeof inlinePanelCopy === "object" ? inlinePanelCopy : null;
    const lang = getActiveLang();
    const toolId = detectToolId();
    const canUseInline = !!(inline && inline.toolId && inline.toolId === toolId && Array.isArray(inline.toolBenefits) && Array.isArray(inline.globalBenefits));

    if (!root) return;
    if (!canUseInline && !proCopy) return; // Keep static HTML until we have copy to render.

    const key = `${lang}|${toolId || "none"}|${canUseInline ? "inline" : "fetched"}`;
    if (key === lastBenefitsRenderKey) return;
    lastBenefitsRenderKey = key;

    const panelCfg = canUseInline
      ? (inline.panel || {})
      : ((proCopy && proCopy.panel && (proCopy.panel[lang] || proCopy.panel.en)) || {});

    const oneliner = String(panelCfg.oneLiner || "");
    const onelinerEl = root.querySelector("[data-pro-panel-oneliner]");
    if (onelinerEl && oneliner) onelinerEl.textContent = oneliner;

    const toolWrap = root.querySelector("[data-pro-tool-benefits-wrap]");
    const toolTitle = root.querySelector("[data-pro-tool-benefits-title]");
    const globalTitle = root.querySelector("[data-pro-global-benefits-title]");
    const toolList = root.querySelector("[data-pro-tool-benefits]");
    const globalList = root.querySelector("[data-pro-global-benefits]");

    if (toolTitle && panelCfg.toolBenefitsTitle) toolTitle.textContent = String(panelCfg.toolBenefitsTitle);
    if (globalTitle && panelCfg.globalBenefitsTitle) globalTitle.textContent = String(panelCfg.globalBenefitsTitle);

    const globalItems = canUseInline
      ? inline.globalBenefits
      : (proCopy && proCopy.globalBenefits && (proCopy.globalBenefits[lang] || proCopy.globalBenefits.en));
    renderBenefitList(globalList, globalItems);

    const toolItems = (() => {
      if (canUseInline) return inline.toolBenefits;
      const tool = toolId && proCopy && proCopy.toolById ? proCopy.toolById[toolId] : null;
      return tool && tool.proBenefits ? (tool.proBenefits[lang] || tool.proBenefits.en) : null;
    })();

    if (toolWrap) toolWrap.style.display = toolItems && toolItems.length ? "" : "none";
    renderBenefitList(toolList, toolItems);
  }

  function renderProPanel(root) {
    if (!root) return;

    root.classList.toggle("pro-panel--expanded", !!proState.panelExpanded);
    root.classList.toggle("pro-panel--active", !!proState.isPro);

    const badge = root.querySelector("[data-pro-badge]");
    const buyBtn = root.querySelector("[data-pro-buy]");
    const collapsedTitle = root.querySelector("[data-pro-collapsed-title]");
    const collapsedSub = root.querySelector("[data-pro-collapsed-sub]");
    const toggleBtns = root.querySelectorAll("[data-pro-toggle]");
    const featuresLink = root.querySelector("[data-pro-features-link]");

    renderPanelBenefits(root);

    const hasActivationError = !!proState.activationError && proState.lastAction === "activate";
    const badgeStatus = proState.isPro ? "active" : (hasActivationError ? "failed" : "inactive");

    const activationStatusText = (() => {
      if (!hasActivationError) return "";
      if (proState.activationErrorCode === "NOT_PURCHASED") {
        return "❌ Not found: We couldn’t find a Pro purchase for this email. Double-check the email on your Stripe receipt.";
      }
      if (proState.activationErrorCode === "DEVICE_LIMIT_REACHED") {
        return "⚠️ Device limit reached: This Pro license is already active on 2 devices. Contact support to reset: support@midieasy.com";
      }
      return `❌ Activation failed: ${proState.activationError}`;
    })();

    if (badge) {
      badge.textContent = badgeStatus === "active" ? "Pro Active" : (badgeStatus === "failed" ? "Activation failed" : "Pro");
      badge.classList.toggle("pro-badge--active", badgeStatus === "active");
      badge.classList.toggle("pro-badge--failed", badgeStatus === "failed");
    }
    if (collapsedTitle && collapsedSub) {
      if (proState.isPro) {
        collapsedTitle.textContent = "✅ Pro Active";
        collapsedSub.textContent = "All tools unlocked on this device.";
      } else {
        collapsedTitle.textContent = "Unlock Pro — $9.90 lifetime";
        const lang = getActiveLang();
        const fallback = "One purchase unlocks Pro across all MidiEasy tools.";
        const one = inlinePanelCopy && inlinePanelCopy.panel
          ? inlinePanelCopy.panel
          : (proCopy && proCopy.panel ? (proCopy.panel[lang] || proCopy.panel.en) : null);
        collapsedSub.textContent = (one && one.oneLiner) ? String(one.oneLiner) : fallback;
      }
    }
    if (toggleBtns && toggleBtns.length) {
      toggleBtns.forEach((btn) => {
        if (!(btn instanceof HTMLButtonElement)) return;
        if (btn.closest("[data-pro-collapsed]")) {
          btn.textContent = proState.isPro ? "See Pro features" : "Upgrade";
        } else {
          btn.textContent = "Hide";
        }
      });
    }
    if (featuresLink) {
      const p = String(globalThis.location?.pathname || "/");
      const prefix = p.startsWith("/zh/") ? "/zh" : (p.startsWith("/de/") ? "/de" : "");
      featuresLink.setAttribute("href", `${prefix}/pro/`);
      featuresLink.style.display = isProLandingPage(p) ? "none" : "";
    }

    renderActivationUi(root, { idleStatusMode: "hide" });

    if (buyBtn) {
      buyBtn.classList.toggle("is-disabled", proState.loading);
      buyBtn.setAttribute("aria-disabled", proState.loading ? "true" : "false");
    }
  }

  function renderActivateInline(root) {
    if (!root) return;
    renderActivationUi(root, { idleStatusMode: "hide" });
  }

  function render() {
    renderProPanel($("#pro-panel"));
    renderActivateInline($("#pro-activate-inline"));
  }

  async function verifyIfNeeded() {
    const token = getToken();
    if (!token) return;
    const last = getLastVerifyAt();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (now - last < oneDay && proState.isPro) return;

    setProState({ loading: true, activationError: "", activationErrorCode: "", verifyError: "", lastAction: "verify" });
    try {
      const deviceId = getOrCreateDeviceId();
      const result = await postJson("/api/pro/verify", { token, device_id: deviceId });
      setLastVerifyAt(now);
      setProState({ isPro: !!result.pro, loading: false, verifyError: "", lastAction: "verify" });
    } catch (e) {
      setProState({ loading: false, verifyError: e.message || "Verify failed", lastAction: "verify" });
    }
  }

  async function activate(email) {
    setProState({ loading: true, activationError: "", activationErrorCode: "", verifyError: "", lastAction: "activate" });
    try {
      const deviceId = getOrCreateDeviceId();
      const normalized = normalizeEmail(email);
      const result = await postJson("/api/pro/activate", { email: normalized, device_id: deviceId });
      if (result.token) setToken(result.token);
      setLastVerifyAt(Date.now());
      setActivatedEmail(normalized);
      setProState({ isPro: true, activatedEmail: normalized, loading: false, activationError: "", activationErrorCode: "", lastAction: "activate", panelExpanded: true });
    } catch (e) {
      const code = e.code || "REQUEST_FAILED";
      let message = e.message || "Activation failed";
      if (code === "NOT_PURCHASED") {
        message = "We couldn’t find a Pro purchase for this email.";
      } else if (code === "INVALID_EMAIL") {
        message = "Invalid email. Please use the email you entered at checkout.";
      } else if (code === "DEVICE_LIMIT_REACHED") {
        message = "This Pro license is already active on 2 devices.";
      }
      setProState({ isPro: false, loading: false, activationError: message, activationErrorCode: code, lastAction: "activate", panelExpanded: true });
    }
  }

  function deactivate() {
    clearToken();
    clearActivatedEmail();
    setLastVerifyAt(0);
    setProState({ isPro: false, activatedEmail: "", loading: false, activationError: "", verifyError: "", lastAction: "deactivate" });
  }

  function setPanelExpanded(expanded, { persistMode } = { persistMode: false }) {
    if (persistMode) {
      setStoredPanelMode(expanded ? "expanded" : "collapsed");
    }
    setProState({ panelExpanded: !!expanded });
  }

  function shouldExpandPanelForHash(hash) {
    const h = String(hash || "");
    return h === "#pro-panel" || h === "#activate";
  }

  function maybeExpandPanelForHash({ smoothScroll } = { smoothScroll: false }) {
    const hash = globalThis.location?.hash || "";
    if (!shouldExpandPanelForHash(hash)) return;
    if (!proState.panelExpanded) {
      setPanelExpanded(true, { persistMode: false });
    }
    globalThis.setTimeout(() => {
      const el = document.querySelector(hash);
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: smoothScroll ? "smooth" : "auto", block: "start" });
      } catch {
        el.scrollIntoView();
      }
    }, 0);
  }

  function wireUi() {
    const root = $("#pro-panel");
    if (!root) return;

    const activateBtn = root.querySelector("[data-pro-activate]");
    const emailInput = root.querySelector("[data-pro-email]");
    const buyBtn = root.querySelector("[data-pro-buy]");
    const toggleBtns = root.querySelectorAll("[data-pro-toggle]");

    if (buyBtn) {
      buyBtn.addEventListener("click", (e) => {
        if (proState.loading) {
          e.preventDefault();
          e.stopPropagation();
        }
      });
    }

    if (activateBtn && emailInput) {
      const submit = async () => {
        if (proState.isPro) {
          deactivate();
          return;
        }
        const normalized = normalizeEmail(emailInput.value);
        if (!normalized || !isValidEmail(normalized)) return;
        await activate(normalized);
      };

      activateBtn.addEventListener("click", async () => {
        await submit();
      });

      emailInput.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        await submit();
      });

      emailInput.addEventListener("blur", () => {
        const normalized = normalizeEmail(emailInput.value);
        if (normalized && emailInput.value !== normalized) {
          emailInput.value = normalized;
          render();
        }
      });

      emailInput.addEventListener("input", () => {
        if (proState.activationError) {
          setProState({ activationError: "", activationErrorCode: "" });
          return;
        }
        render();
      });
    }

    if (toggleBtns && toggleBtns.length) {
      toggleBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const isCollapsedBtn = !!btn.closest && !!btn.closest("[data-pro-collapsed]");
          if (isCollapsedBtn && proState.isPro) {
            const lang = getActiveLang();
            const prefix = lang === "zh" ? "/zh" : (lang === "de" ? "/de" : "");
            globalThis.location.href = `${prefix}/pro/`;
            return;
          }
          setPanelExpanded(!proState.panelExpanded, { persistMode: true });
        });
      });
    }
  }

  function wireActivateInlineUi() {
    const root = $("#pro-activate-inline");
    if (!root) return;

    const activateBtn = root.querySelector("[data-pro-activate]");
    const emailInput = root.querySelector("[data-pro-email]");

    if (activateBtn && emailInput) {
      const submit = async () => {
        if (proState.isPro) {
          deactivate();
          return;
        }
        const normalized = normalizeEmail(emailInput.value);
        if (!normalized || !isValidEmail(normalized)) return;
        await activate(normalized);
      };

      activateBtn.addEventListener("click", async () => {
        await submit();
      });

      emailInput.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        await submit();
      });

      emailInput.addEventListener("blur", () => {
        const normalized = normalizeEmail(emailInput.value);
        if (normalized && emailInput.value !== normalized) {
          emailInput.value = normalized;
          render();
        }
      });

      emailInput.addEventListener("input", () => {
        if (proState.activationError) {
          setProState({ activationError: "", activationErrorCode: "" });
          return;
        }
        render();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    getOrCreateDeviceId();
    globalThis.proState = proState;
    inlinePanelCopy = readInlinePanelCopy();
    wireUi();
    wireActivateInlineUi();
    render();
    if ($("#pro-panel")) {
      loadProCopy().then(() => render()).catch(() => {});
    }
    announceProChange({ force: true });
    maybeExpandPanelForHash({ smoothScroll: false });
    void verifyIfNeeded();
  });

  globalThis.addEventListener("hashchange", () => {
    maybeExpandPanelForHash({ smoothScroll: true });
  });

  document.addEventListener("midieasy:conversion-complete", (event) => {
    const detail = event && typeof event === "object" ? event.detail : null;
    const successCount = detail && typeof detail.successCount === "number" ? detail.successCount : null;
    if (successCount !== null && successCount <= 0) return;

    setHasConverted();
    if (isProLandingPage(globalThis.location?.pathname)) return;
    if (getStoredPanelMode()) return; // Respect explicit user choice.
    setPanelExpanded(true, { persistMode: false });
  });
})();
