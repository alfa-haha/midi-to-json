import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = process.cwd();
const LEGACY_DIR = path.join(ROOT, "legacy");
const OUT_DIR = path.join(ROOT, "_site");
const SRC_PAGES_DIR = path.join(ROOT, "src", "pages");
const NON_PAGE_HTML_OUTPUTS = [
  path.join("blog", "_article-template.html"),
  path.join("blog", "components", "related-articles-section.html")
];
const HOST_REWRITE_TEXT_EXTENSIONS = new Set([
  ".html",
  ".xml",
  ".txt",
  ".json",
  ".js",
  ".css"
]);

const PRO_PANEL_SNIPPET_PATH = path.join(ROOT, "src", "_includes", "snippets", "pro-panel.html");
const FOOTER_SNIPPET_PATH = path.join(ROOT, "src", "_includes", "snippets", "footer-standard.html");
const PRO_SCRIPT_TAG = `<script src="/js/pro.js"></script>`;
const PRO_PANEL_PLACEHOLDER = "<!-- MIDIEASY_PRO_PANEL -->";
const PRO_SCRIPT_PLACEHOLDER = "<!-- MIDIEASY_PRO_SCRIPTS -->";

const GTM_CONTAINER_ID = "GTM-K6F6DTVC";
const GTM_HEAD_SNIPPET = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_CONTAINER_ID}');</script>
<!-- End Google Tag Manager -->`;

const GTM_BODY_SNIPPET = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;
const FAVICON_HEAD_SNIPPET = `<!-- Favicon -->
<link rel="apple-touch-icon" sizes="180x180" href="/favicon_io/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon_io/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon_io/favicon-16x16.png">
<link rel="icon" href="/favicon_io/favicon.ico" sizes="any">
<link rel="shortcut icon" href="/favicon_io/favicon.ico">
<link rel="manifest" href="/favicon_io/site.webmanifest">`;

async function listFilesRecursive(dir) {
  const out = [];
  async function walk(d) {
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile()) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizePublicUrl(raw, { baseUrl }) {
  if (!raw) return "";
  try {
    const u = new URL(String(raw).trim());
    const base = new URL(baseUrl);
    if (u.origin !== base.origin) return "";
    u.search = "";
    u.hash = "";
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.replace(/\/+$/, "");
    }
    return u.toString();
  } catch {
    return "";
  }
}

function extractCanonicalHref(html) {
  const m = String(html || "").match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i);
  return m ? String(m[1]).trim() : "";
}

function extractAlternateLinks(html) {
  const out = [];
  const re = /<link\s+rel=["']alternate["'][^>]*>/gi;
  const s = String(html || "");
  let m;
  while ((m = re.exec(s)) !== null) {
    const tag = m[0];
    const hreflangMatch = tag.match(/hreflang=["']([^"']+)["']/i);
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hreflangMatch || !hrefMatch) continue;
    out.push({
      lang: String(hreflangMatch[1]).trim(),
      href: String(hrefMatch[1]).trim()
    });
  }
  return out;
}

function sortHreflangEntries(entries) {
  return entries.sort((a, b) => {
    if (a.lang === "x-default" && b.lang !== "x-default") return 1;
    if (a.lang !== "x-default" && b.lang === "x-default") return -1;
    return a.lang.localeCompare(b.lang);
  });
}

async function generateSitemapXmlFromOutDir(outDir, { baseUrl }) {
  const files = await listFilesRecursive(outDir);
  const htmlFiles = files.filter((f) => f.endsWith(".html"));

  const byCanonical = new Map();
  for (const filePath of htmlFiles) {
    const html = await fs.readFile(filePath, "utf8");
    const canonicalRaw = extractCanonicalHref(html);
    const canonical = normalizePublicUrl(canonicalRaw, { baseUrl });
    if (!canonical) continue;

    let row = byCanonical.get(canonical);
    if (!row) {
      row = { loc: canonical, alternates: new Map() };
      byCanonical.set(canonical, row);
    }

    const alternates = extractAlternateLinks(html);
    for (const alt of alternates) {
      const href = normalizePublicUrl(alt.href, { baseUrl });
      if (!href) continue;
      row.alternates.set(alt.lang, href);
    }
  }

  const canonicalSet = new Set(byCanonical.keys());
  for (const row of byCanonical.values()) {
    for (const [lang, href] of Array.from(row.alternates.entries())) {
      if (!canonicalSet.has(href)) {
        row.alternates.delete(lang);
      }
    }
  }

  const entries = Array.from(byCanonical.values()).sort((a, b) => a.loc.localeCompare(b.loc));
  const hasAlternates = entries.some((e) => e.alternates.size > 0);
  const xmlns = hasAlternates
    ? '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
    : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', xmlns];
  for (const entry of entries) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    const alternates = sortHreflangEntries(
      Array.from(entry.alternates.entries()).map(([lang, href]) => ({ lang, href }))
    );
    for (const alt of alternates) {
      lines.push(`    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.lang)}" href="${escapeXml(alt.href)}" />`);
    }
    lines.push("  </url>");
  }
  lines.push("</urlset>");

  await fs.writeFile(path.join(outDir, "sitemap.xml"), `${lines.join("\n")}\n`, "utf8");
}

async function generateRobotsTxt(outDir, { baseUrl }) {
  const robots = [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /.git/",
    "Disallow: /.vscode/",
    "Disallow: /node_modules/",
    "",
    `Sitemap: ${baseUrl.replace(/\/+$/, "")}/sitemap.xml`,
    ""
  ].join("\n");
  await fs.writeFile(path.join(outDir, "robots.txt"), robots, "utf8");
}

function extractFrontMatter(text) {
  const s = String(text || "");
  if (!s.startsWith("---")) return { frontMatter: "", body: s };
  const end = s.indexOf("\n---", 3);
  if (end === -1) return { frontMatter: "", body: s };
  const fm = s.slice(3, end).replace(/^\n/, "");
  const body = s.slice(end + "\n---".length);
  return { frontMatter: fm, body };
}

function extractToolId(frontMatter) {
  const m = String(frontMatter || "").match(/^toolId:\s*([^\s]+)\s*$/m);
  return m ? String(m[1]).trim() : "";
}

function validateProCopy(proCopy) {
  if (!proCopy || typeof proCopy !== "object") throw new Error("proCopy missing or invalid");
  if (!Array.isArray(proCopy.tools) || !proCopy.tools.length) throw new Error("proCopy.tools missing");
  if (!proCopy.toolById || typeof proCopy.toolById !== "object") throw new Error("proCopy.toolById missing");

  const globalEn = proCopy.globalBenefits && proCopy.globalBenefits.en;
  if (!Array.isArray(globalEn) || globalEn.length < 4) throw new Error("proCopy.globalBenefits.en must have 4 items");

  for (const t of proCopy.tools) {
    if (!t || typeof t !== "object") throw new Error("proCopy.tools contains invalid item");
    if (!t.id) throw new Error("proCopy.tools item missing id");
    if (!t.paths || !t.paths.en) throw new Error(`proCopy.tools[${t.id}] missing paths.en`);
    if (!t.proBenefits || !Array.isArray(t.proBenefits.en) || t.proBenefits.en.length < 2) {
      throw new Error(`proCopy.tools[${t.id}] missing proBenefits.en (>=2 items)`);
    }
    if (!proCopy.toolById[t.id]) throw new Error(`proCopy.toolById missing key for ${t.id}`);
  }
}

async function validateToolPagesHaveToolId({ proCopy }) {
  const files = await listFilesRecursive(SRC_PAGES_DIR);
  const pages = files.filter((f) => f.endsWith(".njk"));
  for (const filePath of pages) {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.includes('{% include "components/pro-panel.njk" %}')) continue;
    const { frontMatter } = extractFrontMatter(raw);
    const toolId = extractToolId(frontMatter);
    if (!toolId) {
      throw new Error(`Missing toolId in front matter: ${path.relative(ROOT, filePath)}`);
    }
    if (!proCopy.toolById || !proCopy.toolById[toolId]) {
      throw new Error(`Unknown toolId "${toolId}" in ${path.relative(ROOT, filePath)} (missing in proCopy.toolById)`);
    }
  }
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rmDir(p) {
  await fs.rm(p, { recursive: true, force: true });
}

async function mkdirp(p) {
  await fs.mkdir(p, { recursive: true });
}

async function copyDir(src, dest) {
  const stat = await fs.stat(src);
  if (!stat.isDirectory()) throw new Error(`Not a directory: ${src}`);
  await mkdirp(dest);
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isSymbolicLink()) {
      const link = await fs.readlink(from);
      await fs.symlink(link, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

function injectOnce(html, needle, insertion) {
  if (html.includes(insertion)) return html;
  if (!html.includes(needle)) return html;
  return html.replace(needle, insertion);
}

function injectBeforeBodyEndIfMissing(html, insertion) {
  if (html.includes(insertion)) return html;
  const idx = html.lastIndexOf("</body>");
  if (idx === -1) return html;
  return html.slice(0, idx) + `\n    ${insertion}\n` + html.slice(idx);
}

function replaceFooter(html, newFooterHtml) {
  const start = html.indexOf("<footer");
  if (start === -1) return html;
  const end = html.indexOf("</footer>", start);
  if (end === -1) return html;
  return html.slice(0, start) + newFooterHtml + html.slice(end + "</footer>".length);
}

function injectGtmIntoHtml(html) {
  if (!html || typeof html !== "string") return html;
  if (html.includes(GTM_CONTAINER_ID) || html.includes("googletagmanager.com/gtm.js")) return html;

  let out = html;

  // 1) Put the script into <head> as high as possible (right after <head ...>).
  out = out.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${GTM_HEAD_SNIPPET}\n`);

  // 2) Put the noscript right after the opening <body ...>.
  out = out.replace(/<body(\s[^>]*)?>/i, (m) => `${m}\n    ${GTM_BODY_SNIPPET}\n`);

  return out;
}

function injectFaviconIntoHtml(html) {
  if (!html || typeof html !== "string") return html;
  if (html.includes('/favicon_io/favicon.ico') || html.includes("/favicon_io/favicon.ico")) return html;
  return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n    ${FAVICON_HEAD_SNIPPET}\n`);
}

async function injectProIntoFile(outFilePath, proPanelHtml) {
  const html = await fs.readFile(outFilePath, "utf8");
  let next = html;
  if (next.includes(PRO_PANEL_PLACEHOLDER)) {
    next = next.replace(PRO_PANEL_PLACEHOLDER, proPanelHtml);
  }
  if (next.includes(PRO_SCRIPT_PLACEHOLDER)) {
    next = next.replace(PRO_SCRIPT_PLACEHOLDER, PRO_SCRIPT_TAG);
  } else {
    next = injectBeforeBodyEndIfMissing(next, PRO_SCRIPT_TAG);
  }

  if (next !== html) {
    await fs.writeFile(outFilePath, next, "utf8");
  }
}

function langForOutPath(outFilePath) {
  const normalized = outFilePath.split(path.sep).join("/");
  if (normalized.includes("/_site/zh/")) return "zh";
  if (normalized.includes("/_site/de/")) return "de";
  return "en";
}

function safeJsonInScriptTag(json) {
  return JSON.stringify(json).replaceAll("</script", "<\\/script");
}

function injectInlineProPanelCopy(proPanelHtml, { proCopy, lang, toolId }) {
  if (!proPanelHtml || proPanelHtml.includes('id="midieasy-pro-panel-copy"')) return proPanelHtml;
  const panelCfg = (proCopy.panel && (proCopy.panel[lang] || proCopy.panel.en)) || {};
  const globalItems = (proCopy.globalBenefits && (proCopy.globalBenefits[lang] || proCopy.globalBenefits.en)) || [];
  const tool = proCopy.toolById ? proCopy.toolById[toolId] : null;
  const toolItems = tool && tool.proBenefits ? (tool.proBenefits[lang] || tool.proBenefits.en) : [];

  const payload = { toolId, lang, panel: panelCfg, globalBenefits: globalItems, toolBenefits: toolItems };
  const script = `\n<script type="application/json" id="midieasy-pro-panel-copy">${safeJsonInScriptTag(payload)}</script>\n`;
  return proPanelHtml + script;
}

function renderStandardFooter(footerTemplate, { homeHref, blogHref, proHref, toolJsonHref, toolCsvHref, toolInspectorHref, supportEmail }) {
  const supportMailto = `mailto:${supportEmail}`;
  const supportContactMailto = `mailto:${supportEmail}?subject=Contact%20from%20MidiEasy`;

  return footerTemplate
    .replaceAll("__SUPPORT_EMAIL__", supportEmail)
    .replaceAll("__SUPPORT_MAILTO__", supportMailto)
    .replaceAll("__SUPPORT_CONTACT_MAILTO__", supportContactMailto)
    .replaceAll("__HOME_HREF__", homeHref)
    .replaceAll("__BLOG_HREF__", blogHref)
    .replaceAll("__PRO_HREF__", proHref)
    .replaceAll("__MIDI_JSON_HREF__", toolJsonHref)
    .replaceAll("__MIDI_CSV_HREF__", toolCsvHref)
    .replaceAll("__MIDI_INSPECTOR_HREF__", toolInspectorHref);
}

function footerContextForOutPath(outFilePath) {
  const normalized = outFilePath.split(path.sep).join("/");
  const isZh = normalized.includes("/_site/zh/");
  const isDe = normalized.includes("/_site/de/");
  const isEnDir = normalized.includes("/_site/en/");

  const supportEmail = "support@midieasy.com";
  const blogHref = "/blog/index.html";

  if (isZh) {
    return {
      supportEmail,
      blogHref,
      homeHref: "/zh/index.html",
      proHref: "/zh/pro/",
      toolJsonHref: "/zh/",
      toolCsvHref: "/zh/midi-to-csv/",
      toolInspectorHref: "/zh/midi-inspector/"
    };
  }

  if (isDe) {
    return {
      supportEmail,
      blogHref,
      homeHref: "/de/index.html",
      proHref: "/de/pro/",
      toolJsonHref: "/de/",
      toolCsvHref: "/de/midi-to-csv/",
      toolInspectorHref: "/de/midi-inspector/"
    };
  }

  if (isEnDir) {
    return {
      supportEmail,
      blogHref,
      homeHref: "/en/index.html",
      proHref: "/pro/",
      toolJsonHref: "/",
      toolCsvHref: "/midi-to-csv/",
      toolInspectorHref: "/midi-inspector/"
    };
  }

  return {
    supportEmail,
    blogHref,
    homeHref: "/",
    proHref: "/pro/",
    toolJsonHref: "/",
    toolCsvHref: "/midi-to-csv/",
    toolInspectorHref: "/midi-inspector/"
  };
}

async function rewriteLegacyFooters(outDir, footerTemplate) {
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        const html = await fs.readFile(full, "utf8");
        const ctx = footerContextForOutPath(full);
        const footerHtml = renderStandardFooter(footerTemplate, ctx);
        const next = replaceFooter(html, footerHtml);
        if (next !== html) {
          await fs.writeFile(full, next, "utf8");
        }
      }
    }
  }

  await walk(outDir);
}

async function injectGtmIntoOutDir(outDir) {
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        const html = await fs.readFile(full, "utf8");
        const withGtm = injectGtmIntoHtml(html);
        const next = injectFaviconIntoHtml(withGtm);
        if (next !== html) {
          await fs.writeFile(full, next, "utf8");
        }
      }
    }
  }

  await walk(outDir);
}

async function normalizeSiteOriginInOutDir(outDir, { baseUrl }) {
  const canonical = new URL(baseUrl);
  const rootHost = canonical.hostname.replace(/^www\./, "");
  const canonicalOrigin = canonical.origin;
  const candidateOrigins = [
    `https://${rootHost}`,
    `https://www.${rootHost}`,
    `http://${rootHost}`,
    `http://www.${rootHost}`
  ];
  const fromOrigins = candidateOrigins.filter((origin) => origin !== canonicalOrigin);
  if (!fromOrigins.length) return;

  const files = await listFilesRecursive(outDir);
  for (const filePath of files) {
    if (!HOST_REWRITE_TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())) continue;

    const current = await fs.readFile(filePath, "utf8");
    let next = current;
    for (const fromOrigin of fromOrigins) {
      if (next.includes(fromOrigin)) {
        next = next.replaceAll(fromOrigin, canonicalOrigin);
      }
    }

    if (next !== current) {
      await fs.writeFile(filePath, next, "utf8");
    }
  }
}

function transformEnHomeToDe(enHtml) {
  let out = enHtml;
  out = out.replace('<html lang="en">', '<html lang="de">');
  out = out.replace(
    /rel="canonical" href="https:\/\/(?:www\.)?midieasy\.com\/en\/?"/,
    'rel="canonical" href="https://www.midieasy.com/de"'
  );
  out = out.replace(
    /hreflang="de" href="https:\/\/(?:www\.)?midieasy\.com\/de\/?"/,
    'hreflang="de" href="https://www.midieasy.com/de"'
  );

  // Remove unused language hreflang lines (MVP: en/zh/de only).
  out = out
    .split("\n")
    .filter((line) => !line.includes('hreflang="ja"') && !line.includes('hreflang="es"'))
    .join("\n");

  // Remove unused language dropdown options (MVP: en/zh/de only).
  out = out.replace(/\s*<div class="language-option" data-lang="ja"[\s\S]*?<\/div>\s*/g, "\n");
  out = out.replace(/\s*<div class="language-option" data-lang="es"[\s\S]*?<\/div>\s*/g, "\n");

  // Switch active option from en -> de
  out = out.replace(
    '<div class="language-option active" data-lang="en" data-url="/en/">',
    '<div class="language-option" data-lang="en" data-url="/en/">'
  );
  out = out.replace(
    '<div class="language-option" data-lang="de" data-url="/de/">',
    '<div class="language-option active" data-lang="de" data-url="/de/">'
  );

  // Update current language label in header.
  out = out.replace('<span id="current-language">English</span>', '<span id="current-language">Deutsch</span>');

  // Load German i18n file.
  out = out.replace('<script src="../js/i18n/en.js"></script>', '<script src="../js/i18n/de.js"></script>');

  return out;
}

async function removeNonPageHtmlFromOutDir(outDir) {
  for (const relativePath of NON_PAGE_HTML_OUTPUTS) {
    const fullPath = path.join(outDir, relativePath);
    await fs.rm(fullPath, { force: true });
  }
}

async function generateDeHomeIntoOutDir() {
  const enHomePath = path.join(LEGACY_DIR, "en", "index.html");
  const outDePath = path.join(OUT_DIR, "de", "index.html");
  if (!(await pathExists(enHomePath))) {
    throw new Error(`Missing legacy english homepage: ${enHomePath}`);
  }
  const enHtml = await fs.readFile(enHomePath, "utf8");
  const deHtml = transformEnHomeToDe(enHtml);
  await mkdirp(path.dirname(outDePath));
  await fs.writeFile(outDePath, deHtml, "utf8");
}

async function runEleventy() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["eleventy"], {
      stdio: "inherit"
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Eleventy failed with exit code ${code}`));
    });
  });
}

async function runBuildJs() {
  await new Promise((resolve, reject) => {
    const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build:js"], {
      stdio: "inherit"
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`build:js failed with exit code ${code}`));
    });
  });
}

async function main() {
  const require = createRequire(import.meta.url);
  const proCopy = require("./../src/_data/proCopy.js");
  const siteData = require("./../src/_data/site.js");
  const baseUrl = (siteData && siteData.baseUrl) ? String(siteData.baseUrl) : "https://www.midieasy.com";
  validateProCopy(proCopy);
  await validateToolPagesHaveToolId({ proCopy });

  if (!(await pathExists(LEGACY_DIR))) {
    throw new Error(`Missing legacy dir: ${LEGACY_DIR}. Run the migration step first.`);
  }

  await rmDir(OUT_DIR);
  await mkdirp(OUT_DIR);

  // 1) Copy legacy site into output (preserve all existing SEO/content).
  await copyDir(LEGACY_DIR, OUT_DIR);

  // 2) Generate German homepage deterministically from legacy english homepage.
  //    This avoids maintaining a hand-copied de/index.html in the repo.
  await generateDeHomeIntoOutDir();
  await removeNonPageHtmlFromOutDir(OUT_DIR);

  // 2.5) Rewrite legacy footers to the shared standard footer module.
  const footerTemplate = await fs.readFile(FOOTER_SNIPPET_PATH, "utf8");
  await rewriteLegacyFooters(OUT_DIR, footerTemplate);

  // 3) Inject the Pro panel into legacy pages (single source of truth snippet).
  const proPanelTemplate = await fs.readFile(PRO_PANEL_SNIPPET_PATH, "utf8");
  const targets = [
    path.join(OUT_DIR, "index.html"),
    path.join(OUT_DIR, "zh", "index.html"),
    path.join(OUT_DIR, "en", "index.html"),
    path.join(OUT_DIR, "de", "index.html")
  ];
  for (const filePath of targets) {
    if (await pathExists(filePath)) {
      const lang = langForOutPath(filePath);
      const proPanelHtml = injectInlineProPanelCopy(proPanelTemplate, { proCopy, lang, toolId: "midi-to-json" });
      await injectProIntoFile(filePath, proPanelHtml);
    }
  }

  // 3.5) Build browser bundles (midi-to-csv etc) into src/static/js, then let Eleventy passthrough copy them.
  await runBuildJs();

	// 4) Generate new pages (tools/pro) into the same output directory.
	await runEleventy();
  await removeNonPageHtmlFromOutDir(OUT_DIR);

  // 5) Inject GTM into *all* output HTML (legacy + new pages).
  await injectGtmIntoOutDir(OUT_DIR);

  // 6) Normalize absolute site URLs to a single origin in final output.
  await normalizeSiteOriginInOutDir(OUT_DIR, { baseUrl });

  // 7) Regenerate crawl files from final output (canonical-aware, no stale URLs).
  await generateSitemapXmlFromOutDir(OUT_DIR, { baseUrl });
  await generateRobotsTxt(OUT_DIR, { baseUrl });
}

await main();
