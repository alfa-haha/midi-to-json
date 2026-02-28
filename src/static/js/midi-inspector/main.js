import { parseMidiInspectorData, tickToSecondsFromSegments } from "../midi-core/parse.js";
import { buildInspectorReport, buildEventsJson, filterEvents, filterNotes, notesToInspectorCsv } from "../midi-core/export.js";

const TOOL_VERSION = "0.1.0";
const EVENTS_PER_PAGE = 200;
const NOTES_PER_PAGE = 200;
const FREE_EXPORT_NOTES_HARD_LIMIT = 200_000;

function yieldToMainThread() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") return requestAnimationFrame(() => resolve());
    setTimeout(resolve, 0);
  });
}

function bytesToHuman(bytes) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)}${units[i]}`;
}

function getFileIdentityKey(file) {
  const lastModified = typeof file.lastModified === "number" ? file.lastModified : 0;
  return `${file.name}::${file.size}::${lastModified}`;
}

function pitchToName(pitch) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const p = Number(pitch);
  if (!Number.isFinite(p)) return "";
  const nn = ((p % 12) + 12) % 12;
  const octave = Math.floor(p / 12) - 1;
  return `${names[nn]}${octave}`;
}

function formatSeconds(sec) {
  if (!Number.isFinite(sec)) return "";
  const s = sec.toFixed(6);
  return s.replace(/\.?0+$/, "");
}

function getIsPro() {
  return !!(globalThis.proState && globalThis.proState.isPro);
}

function expandProPanel() {
  try {
    globalThis.location.hash = "#pro-panel";
  } catch {
    // no-op
  }
  const el = document.querySelector("#pro-panel");
  if (el) {
    try {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      el.scrollIntoView();
    }
  }
}

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function safeText(s) {
  return String(s ?? "");
}

function escapeHtml(s) {
  return safeText(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectedToSet(selectEl) {
  if (!selectEl) return null;
  const set = new Set();
  for (const opt of Array.from(selectEl.selectedOptions || [])) {
    const v = Number(opt.value);
    if (Number.isFinite(v)) set.add(v);
  }
  return set.size ? set : null;
}

function clampInt(n, lo, hi) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const r = Math.floor(x);
  return Math.max(lo, Math.min(hi, r));
}

function parseMaybeInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.floor(x);
}

function paginate(arr, page, perPage) {
  const total = arr.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const p = Math.max(1, Math.min(totalPages, page));
  const start = (p - 1) * perPage;
  const end = Math.min(total, start + perPage);
  return { page: p, total, totalPages, slice: arr.slice(start, end) };
}

function buildEventDetails(e) {
  if (!e) return "";
  if (e.kind === "tempo") {
    const uspb = e.data && typeof e.data.microsecondsPerBeat === "number" ? e.data.microsecondsPerBeat : null;
    const bpm = uspb && uspb > 0 ? (60_000_000 / uspb) : null;
    return bpm ? `${bpm.toFixed(3).replace(/\.?0+$/, "")} BPM` : "tempo";
  }
  if (e.kind === "timeSig") {
    const n = e.data ? e.data.numerator : null;
    const d = e.data ? e.data.denominator : null;
    if (Number.isFinite(n) && Number.isFinite(d)) return `${n}/${d}`;
    return "time signature";
  }
  if (e.kind === "program") {
    const p = e.data ? e.data.program : null;
    return Number.isFinite(p) ? `program=${p}` : "program";
  }
  if (e.kind === "cc") {
    const c = e.data ? e.data.controller : null;
    const v = e.data ? e.data.value : null;
    if (Number.isFinite(c) && Number.isFinite(v)) return `CC${c}=${v}`;
    return "cc";
  }
  if (e.kind === "noteOn") {
    const pitch = e.data ? e.data.pitch : null;
    const vel = e.data ? e.data.velocity : null;
    if (Number.isFinite(pitch) && Number.isFinite(vel)) return `${pitchToName(pitch)} vel=${vel}`;
    return "noteOn";
  }
  if (e.kind === "noteOff") {
    const pitch = e.data ? e.data.pitch : null;
    const vel = e.data ? e.data.velocity : null;
    const v0 = e.data ? !!e.data.velocity0 : false;
    const extra = v0 ? " (v0)" : "";
    if (Number.isFinite(pitch) && Number.isFinite(vel)) return `${pitchToName(pitch)} vel=${vel}${extra}`;
    return `noteOff${extra}`;
  }
  return "";
}

function buildNoteFlags(n) {
  const f = n && n.flags ? n.flags : {};
  const parts = [];
  if (f.overlap) parts.push("overlap");
  if (f.dangling) parts.push("dangling");
  if (f.velocity0_noteoff) parts.push("v0_noteoff");
  return parts.join(", ");
}

function wireMidiInspectorPage() {
  const dropArea = document.querySelector("#inspector-drop-area");
  const fileInput = document.querySelector("#inspector-file-input");
  const fileInfo = document.querySelector("#inspector-file-info");
  const errorEl = document.querySelector("#inspector-error");
  const statusEl = document.querySelector("#inspector-status");
  const inspectBtn = document.querySelector("#inspector-inspect-btn");
  const clearBtn = document.querySelector("#inspector-clear-btn");

  const summaryEl = document.querySelector("#inspector-summary");
  const filtersEl = document.querySelector("#inspector-filters");
  const tabsEl = document.querySelector("#inspector-tabs");
  const exportEl = document.querySelector("#inspector-export");
  const exportMetaEl = document.querySelector("#inspector-export-meta");

  const trackSelect = document.querySelector("#filter-track");
  const channelSelect = document.querySelector("#filter-channel");
  const pitchMinEl = document.querySelector("#filter-pitch-min");
  const pitchMaxEl = document.querySelector("#filter-pitch-max");
  const tickStartEl = document.querySelector("#filter-tick-start");
  const tickEndEl = document.querySelector("#filter-tick-end");
  const flagOverlapEl = document.querySelector("#flag-overlap");
  const flagDanglingEl = document.querySelector("#flag-dangling");
  const flagVelocity0El = document.querySelector("#flag-velocity0");
  const resetFiltersBtn = document.querySelector("#inspector-reset-filters-btn");

  const eventsShowNotesEl = document.querySelector("#events-show-notes");
  const eventsCc64OnlyEl = document.querySelector("#events-cc64-only");
  const eventsTypeFilterEl = document.querySelector("#events-type-filter");

  const tabButtons = Array.from(document.querySelectorAll(".inspector-tab"));
  const tabEvents = document.querySelector("#tab-events");
  const tabTracks = document.querySelector("#tab-tracks");
  const tabNotes = document.querySelector("#tab-notes");

  const eventsTableEl = document.querySelector("#events-table");
  const eventsPagerEl = document.querySelector("#events-pagination");
  const tracksTableEl = document.querySelector("#tracks-table");
  const notesTableEl = document.querySelector("#notes-table");
  const notesPagerEl = document.querySelector("#notes-pagination");

  const exportReportBtn = document.querySelector("#export-report-btn");
  const exportNotesBtn = document.querySelector("#export-notes-btn");
  const exportEventsBtn = document.querySelector("#export-events-btn");

  if (!dropArea || !fileInput || !inspectBtn) return;

  const state = {
    isPro: getIsPro(),
    file: null,
    fileKey: "",
    bytes: null,
    data: null,
    parsing: false,
    activeTab: "events",
    showNoteEvents: false,
    noteEventsLoaded: false,
    cc64Only: true,
    eventTypeSet: new Set(["tempo", "timeSig", "program", "cc"]),
    eventsPage: 1,
    notesPage: 1,
    filters: {
      trackSet: null,
      channelSet: null,
      pitchMin: null,
      pitchMax: null,
      tickStart: null,
      tickEnd: null,
      flags: null,
    },
  };

  function isMidiFile(file) {
    const name = (file && file.name) ? String(file.name).toLowerCase() : "";
    return name.endsWith(".mid") || name.endsWith(".midi");
  }

  function setError(text) {
    if (!errorEl) return;
    if (text) {
      errorEl.style.display = "";
      errorEl.textContent = text;
    } else {
      errorEl.style.display = "none";
      errorEl.textContent = "";
    }
  }

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
  }

  function setBusy(busy) {
    state.parsing = busy;
    if (inspectBtn) inspectBtn.disabled = busy || !state.bytes;
    if (clearBtn) clearBtn.disabled = busy || (!state.bytes && !state.data);
    if (exportReportBtn) exportReportBtn.disabled = busy || !state.data;
    if (exportNotesBtn) exportNotesBtn.disabled = busy || !state.data;
    if (exportEventsBtn) exportEventsBtn.disabled = busy || !state.data || !state.isPro;
  }

  function renderProHints() {
    const hint1 = document.querySelector("#inspector-pro-hint-1");
    const hint2 = document.querySelector("#inspector-pro-hint-2");
    const locked = !state.isPro;
    const msg = locked ? 'Locked. <a href="#pro-panel">Upgrade to Pro</a>.' : "Enabled.";
    if (hint1) hint1.innerHTML = msg;
    if (hint2) hint2.innerHTML = msg;
  }

  function renderSummary() {
    if (!summaryEl || !state.data) return;
    const d = state.data;
    const meta = d.fileMeta || {};
    const q = d.quality || {};
    const tempo = d.tempo || {};

    const durationTicks = meta.durationTicks ?? 0;
    const hasSeconds = meta.divisionType === "PPQ" && !!tempo.tempoMapReady && Array.isArray(tempo.segments);
    const durationSec = hasSeconds ? tickToSecondsFromSegments(tempo.segments, durationTicks) : null;

    const timeSigEventsCount = (d.events || []).reduce((c, e) => c + (e && e.kind === "timeSig" ? 1 : 0), 0);
    const programs = new Set();
    const channels = new Set();
    for (const n of d.notes || []) {
      if (Number.isFinite(n.program)) programs.add(n.program);
      if (Number.isFinite(n.channel)) channels.add(n.channel);
    }

    const flags = [
      q.hasSustainPedalEvents ? "CC64" : null,
      tempo.hasTempoChanges ? "tempo changes" : null,
      (q.overlapCount || 0) > 0 ? `overlap=${q.overlapCount}` : null,
      (q.danglingCount || 0) > 0 ? `dangling=${q.danglingCount}` : null,
      (q.orphanOffCount || 0) > 0 ? `orphanOff=${q.orphanOffCount}` : null,
    ].filter(Boolean);

    const insights = [];
    if (tempo.hasTempoChanges) insights.push("Tempo changes detected: prefer ticks for alignment and exports.");
    if (q.hasSustainPedalEvents) insights.push("CC64 (sustain) detected: durations may be shorter without sustain support.");
    if ((q.overlapCount || 0) > 0) insights.push("Overlapping notes detected: check legato/data quality.");
    if ((q.danglingCount || 0) > 0) insights.push("Dangling notes detected: noteOff missing; ended at track end.");
    if ((q.orphanOffCount || 0) > 0) insights.push("Orphan noteOff detected: noteOff without matching noteOn.");

    const insightsHtml = insights.length
      ? (state.isPro
        ? `
          <div class="inspector-insights">
            <div class="inspector-insights__title">Quality Insights (Pro)</div>
            <ul class="inspector-insights__list">
              ${insights.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
            </ul>
          </div>
        `
        : `
          <div class="inspector-insights inspector-insights--locked">
            <div class="inspector-insights__title">Quality Insights (Pro)</div>
            <div class="inspector-insights__locked">
              Issues detected. <a href="#pro-panel">Upgrade to Pro</a> to see explanations and export what you see.
            </div>
          </div>
        `)
      : "";

    summaryEl.innerHTML = `
      <div class="inspector-summary-grid">
        <div class="inspector-card">
          <div class="inspector-card__k">Duration</div>
          <div class="inspector-card__v">${escapeHtml(String(durationTicks))} ticks</div>
          <div class="inspector-card__s">${hasSeconds ? `${escapeHtml(formatSeconds(durationSec))} s` : "— seconds (PPQ+tempo map required)"}</div>
        </div>
        <div class="inspector-card">
          <div class="inspector-card__k">PPQ</div>
          <div class="inspector-card__v">${escapeHtml(String(meta.ppq ?? "—"))}</div>
          <div class="inspector-card__s">division=${escapeHtml(String(meta.divisionType || "—"))}</div>
        </div>
        <div class="inspector-card">
          <div class="inspector-card__k">Tracks</div>
          <div class="inspector-card__v">${escapeHtml(String(meta.tracksCount ?? 0))}</div>
          <div class="inspector-card__s">timeSig events: ${escapeHtml(String(timeSigEventsCount))}</div>
        </div>
        <div class="inspector-card">
          <div class="inspector-card__k">Notes</div>
          <div class="inspector-card__v">${escapeHtml(String((d.notes || []).length))}</div>
          <div class="inspector-card__s">channels: ${escapeHtml(String(channels.size))} · programs: ${escapeHtml(String(programs.size))}</div>
        </div>
        <div class="inspector-card">
          <div class="inspector-card__k">Tempo</div>
          <div class="inspector-card__v">${escapeHtml(String(tempo.tempoEventsCount ?? 0))} events</div>
          <div class="inspector-card__s">${tempo.hasTempoChanges ? "has changes" : "single tempo"}</div>
        </div>
        <div class="inspector-card">
          <div class="inspector-card__k">Quality</div>
          <div class="inspector-card__v">${flags.length ? escapeHtml(flags.join(" · ")) : "OK"}</div>
          <div class="inspector-card__s">unknown events: ${escapeHtml(String(q.unknownEventCount ?? 0))}</div>
        </div>
      </div>
      ${insightsHtml}
    `;
    summaryEl.style.display = "";
  }

  function renderFilters() {
    if (!filtersEl || !state.data) return;
    filtersEl.style.display = "";
    if (tabsEl) tabsEl.style.display = "";
    if (exportEl) exportEl.style.display = "";

    // Enable/disable Pro fields
    const proDisabled = !state.isPro;
    if (tickStartEl) tickStartEl.disabled = proDisabled;
    if (tickEndEl) tickEndEl.disabled = proDisabled;
    if (flagOverlapEl) flagOverlapEl.disabled = proDisabled;
    if (flagDanglingEl) flagDanglingEl.disabled = proDisabled;
    if (flagVelocity0El) flagVelocity0El.disabled = proDisabled;
    if (exportEventsBtn) exportEventsBtn.disabled = !state.isPro;
    renderProHints();
  }

  function renderFilterOptions() {
    if (!state.data) return;

    // Tracks
    if (trackSelect) {
      const tracks = Array.isArray(state.data.tracks) ? state.data.tracks : [];
      trackSelect.innerHTML = tracks
        .map((t) => `<option value="${t.trackIndex}">${escapeHtml(String(t.trackIndex + 1))}${t.trackName ? ` · ${escapeHtml(t.trackName)}` : ""}</option>`)
        .join("");
    }

    // Channels: derive from notes.
    if (channelSelect) {
      const chSet = new Set();
      for (const n of state.data.notes || []) {
        if (Number.isFinite(n.channel)) chSet.add(n.channel);
      }
      const channels = Array.from(chSet).sort((a, b) => a - b);
      channelSelect.innerHTML = channels.map((c) => `<option value="${c}">${escapeHtml(String(c))}</option>`).join("");
    }
  }

  function currentFilters({ forEvents } = {}) {
    const d = state.data;
    const tempo = d && d.tempo ? d.tempo : {};
    const hasSeconds = d && d.fileMeta && d.fileMeta.divisionType === "PPQ" && !!tempo.tempoMapReady;

    const f = {
      trackSet: state.filters.trackSet,
      channelSet: state.filters.channelSet,
      pitchMin: state.filters.pitchMin,
      pitchMax: state.filters.pitchMax,
      tickStart: state.filters.tickStart,
      tickEnd: state.filters.tickEnd,
      flags: state.filters.flags,
      typeSet: forEvents ? state.eventTypeSet : null,
      cc64Only: forEvents ? state.cc64Only : false,
      hasSeconds,
    };
    return f;
  }

  function renderEventsTab() {
    if (!eventsTableEl || !eventsPagerEl || !state.data) return;

    const filters = currentFilters({ forEvents: true });
    const list = filterEvents(state.data.events, filters).filter((e) => {
      const isNote = e.kind === "noteOn" || e.kind === "noteOff";
      if (!state.showNoteEvents && isNote) return false;
      return true;
    });

    const { page, total, totalPages, slice } = paginate(list, state.eventsPage, EVENTS_PER_PAGE);
    state.eventsPage = page;

    const tempo = state.data.tempo || {};
    const hasSeconds = state.data.fileMeta.divisionType === "PPQ" && !!tempo.tempoMapReady && Array.isArray(tempo.segments);

    const rows = slice
      .map((e) => {
        const seconds = hasSeconds ? formatSeconds(tickToSecondsFromSegments(tempo.segments, e.tick)) : "";
        const ch = e.channel === null ? "" : String(e.channel);
        return `
          <tr>
            <td class="mono">${escapeHtml(String(e.tick))}</td>
            <td class="mono">${hasSeconds ? escapeHtml(seconds) : "—"}</td>
            <td>${escapeHtml(e.kind)}</td>
            <td class="mono">${escapeHtml(String(e.trackIndex + 1))}</td>
            <td class="mono">${escapeHtml(ch)}</td>
            <td class="mono">${escapeHtml(buildEventDetails(e))}</td>
          </tr>
        `;
      })
      .join("");

    eventsTableEl.innerHTML = `
      <table class="inspector-table">
        <thead>
          <tr>
            <th>tick</th>
            <th>sec</th>
            <th>kind</th>
            <th>track</th>
            <th>ch</th>
            <th>data</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="6" style="color:#666;">No events (with current filters).</td></tr>`}
        </tbody>
      </table>
      <div class="inspector-meta">${escapeHtml(String(total))} events</div>
    `;

    eventsPagerEl.innerHTML = `
      <button class="btn btn-sm" type="button" data-action="prev" ${page <= 1 ? "disabled" : ""}>Prev</button>
      <span class="inspector-page">Page ${escapeHtml(String(page))} / ${escapeHtml(String(totalPages))}</span>
      <button class="btn btn-sm" type="button" data-action="next" ${page >= totalPages ? "disabled" : ""}>Next</button>
    `;
  }

  function renderTracksTab() {
    if (!tracksTableEl || !state.data) return;
    const tracks = Array.isArray(state.data.tracks) ? state.data.tracks : [];
    const notes = Array.isArray(state.data.notes) ? state.data.notes : [];

    const noteCountByTrack = new Array(tracks.length).fill(0);
    const channelsByTrack = Array.from({ length: tracks.length }, () => new Set());
    const programsByTrack = Array.from({ length: tracks.length }, () => new Set());

    for (const n of notes) {
      if (!Number.isFinite(n.track_index)) continue;
      if (n.track_index < 0 || n.track_index >= tracks.length) continue;
      noteCountByTrack[n.track_index] += 1;
      if (Number.isFinite(n.channel)) channelsByTrack[n.track_index].add(n.channel);
      if (Number.isFinite(n.program)) programsByTrack[n.track_index].add(n.program);
    }

    const rows = tracks
      .map((t) => {
        const idx = t.trackIndex;
        const ch = Array.from(channelsByTrack[idx]).sort((a, b) => a - b).join(",");
        const pg = Array.from(programsByTrack[idx]).sort((a, b) => a - b).slice(0, 8).join(",");
        const name = t.trackName ? escapeHtml(t.trackName) : '<span style="color:#999;">(unnamed)</span>';
        return `
          <tr data-track="${escapeHtml(String(idx))}">
            <td class="mono">${escapeHtml(String(idx + 1))}</td>
            <td>${name}</td>
            <td class="mono">${escapeHtml(String(t.endTick ?? 0))}</td>
            <td class="mono">${escapeHtml(String(noteCountByTrack[idx] ?? 0))}</td>
            <td class="mono">${escapeHtml(ch)}</td>
            <td class="mono">${escapeHtml(pg)}</td>
          </tr>
        `;
      })
      .join("");

    tracksTableEl.innerHTML = `
      <table class="inspector-table inspector-table--clickable">
        <thead>
          <tr>
            <th>track</th>
            <th>name</th>
            <th>endTick</th>
            <th>notes</th>
            <th>channels</th>
            <th>programs</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="inspector-hint">Click a row to filter by track.</div>
    `;

    // Row click -> track filter
    tracksTableEl.querySelectorAll("tbody tr[data-track]").forEach((tr) => {
      tr.addEventListener("click", () => {
        const v = Number(tr.getAttribute("data-track"));
        if (!Number.isFinite(v)) return;
        if (!trackSelect) return;
        for (const opt of Array.from(trackSelect.options)) opt.selected = false;
        const match = Array.from(trackSelect.options).find((o) => Number(o.value) === v);
        if (match) match.selected = true;
        syncFiltersFromUi({ resetPages: true });
        setActiveTab("notes");
      });
    });
  }

  function renderNotesTab() {
    if (!notesTableEl || !notesPagerEl || !state.data) return;
    const tempo = state.data.tempo || {};
    const hasSeconds = state.data.fileMeta.divisionType === "PPQ" && !!tempo.tempoMapReady;

    const filters = currentFilters();
    const list = filterNotes(state.data.notes, filters);
    const { page, total, totalPages, slice } = paginate(list, state.notesPage, NOTES_PER_PAGE);
    state.notesPage = page;

    const secCols = hasSeconds ? `<th>start_sec</th><th>dur_sec</th>` : "";

    const rows = slice
      .map((n) => {
        const flags = buildNoteFlags(n);
        return `
          <tr>
            <td class="mono">${escapeHtml(String(Number(n.track_index) + 1))}</td>
            <td class="mono">${escapeHtml(String(n.channel ?? ""))}</td>
            <td class="mono">${escapeHtml(String(n.program ?? ""))}</td>
            <td class="mono">${escapeHtml(String(n.pitch ?? ""))}</td>
            <td class="mono">${escapeHtml(pitchToName(n.pitch))}</td>
            <td class="mono">${escapeHtml(String(n.start_ticks ?? ""))}</td>
            <td class="mono">${escapeHtml(String(n.duration_ticks ?? ""))}</td>
            ${hasSeconds ? `<td class="mono">${escapeHtml(formatSeconds(n.start_seconds))}</td><td class="mono">${escapeHtml(formatSeconds(n.duration_seconds))}</td>` : ""}
            <td class="mono">${escapeHtml(String(n.velocity ?? ""))}</td>
            <td style="color:#666;">${escapeHtml(flags)}</td>
          </tr>
        `;
      })
      .join("");

    notesTableEl.innerHTML = `
      <table class="inspector-table">
        <thead>
          <tr>
            <th>track</th>
            <th>ch</th>
            <th>program</th>
            <th>pitch</th>
            <th>name</th>
            <th>start_tick</th>
            <th>dur_tick</th>
            ${secCols}
            <th>vel</th>
            <th>flags</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="${hasSeconds ? 12 : 10}" style="color:#666;">No notes (with current filters).</td></tr>`}
        </tbody>
      </table>
      <div class="inspector-meta">${escapeHtml(String(total))} notes</div>
    `;

    notesPagerEl.innerHTML = `
      <button class="btn btn-sm" type="button" data-action="prev" ${page <= 1 ? "disabled" : ""}>Prev</button>
      <span class="inspector-page">Page ${escapeHtml(String(page))} / ${escapeHtml(String(totalPages))}</span>
      <button class="btn btn-sm" type="button" data-action="next" ${page >= totalPages ? "disabled" : ""}>Next</button>
    `;
  }

  function renderTabs() {
    renderEventsTab();
    renderTracksTab();
    renderNotesTab();
  }

  function renderExportMeta() {
    if (!exportMetaEl || !state.data) return;
    const n = (state.data.notes || []).length;
    exportMetaEl.innerHTML = `
      <div class="inspector-export__pill">${state.isPro ? "Pro" : "Free"}</div>
      <div class="inspector-export__pill">${escapeHtml(String(n))} notes</div>
      <div class="inspector-export__pill">schema=${escapeHtml("v0.1")}</div>
    `;
  }

  function syncFiltersFromUi({ resetPages } = {}) {
    state.filters.trackSet = selectedToSet(trackSelect);
    state.filters.channelSet = selectedToSet(channelSelect);
    state.filters.pitchMin = clampInt(pitchMinEl && pitchMinEl.value, 0, 127);
    state.filters.pitchMax = clampInt(pitchMaxEl && pitchMaxEl.value, 0, 127);

    if (state.isPro) {
      state.filters.tickStart = parseMaybeInt(tickStartEl && tickStartEl.value);
      state.filters.tickEnd = parseMaybeInt(tickEndEl && tickEndEl.value);
      state.filters.flags = {
        overlap: !!(flagOverlapEl && flagOverlapEl.checked),
        dangling: !!(flagDanglingEl && flagDanglingEl.checked),
        velocity0_noteoff: !!(flagVelocity0El && flagVelocity0El.checked),
      };
      if (!state.filters.flags.overlap && !state.filters.flags.dangling && !state.filters.flags.velocity0_noteoff) {
        state.filters.flags = null;
      }
    } else {
      state.filters.tickStart = null;
      state.filters.tickEnd = null;
      state.filters.flags = null;
    }

    if (resetPages) {
      state.eventsPage = 1;
      state.notesPage = 1;
    }
    renderTabs();
    renderExportMeta();
  }

  function resetFilters() {
    if (trackSelect) for (const opt of Array.from(trackSelect.options)) opt.selected = false;
    if (channelSelect) for (const opt of Array.from(channelSelect.options)) opt.selected = false;
    if (pitchMinEl) pitchMinEl.value = "";
    if (pitchMaxEl) pitchMaxEl.value = "";
    if (tickStartEl) tickStartEl.value = "";
    if (tickEndEl) tickEndEl.value = "";
    if (flagOverlapEl) flagOverlapEl.checked = false;
    if (flagDanglingEl) flagDanglingEl.checked = false;
    if (flagVelocity0El) flagVelocity0El.checked = false;
    syncFiltersFromUi({ resetPages: true });
  }

  function setActiveTab(tab) {
    state.activeTab = tab;
    for (const btn of tabButtons) {
      const isActive = btn.getAttribute("data-tab") === tab;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    if (tabEvents) tabEvents.style.display = tab === "events" ? "" : "none";
    if (tabTracks) tabTracks.style.display = tab === "tracks" ? "" : "none";
    if (tabNotes) tabNotes.style.display = tab === "notes" ? "" : "none";
  }

  async function parseAndRender({ includeNoteEvents }) {
    if (!state.bytes) return;
    setError("");
    setBusy(true);
    setStatus("Parsing…");
    await yieldToMainThread();

    try {
      const data = parseMidiInspectorData(state.bytes, { includeNoteEvents });
      state.data = data;
      state.noteEventsLoaded = !!includeNoteEvents;
      setStatus(`Parsed in browser. PPQ=${data.fileMeta.ppq}, tracks=${data.fileMeta.tracksCount}, notes=${data.notes.length}.`);
      renderFilterOptions();
      renderSummary();
      renderFilters();
      renderExportMeta();
      setActiveTab(state.activeTab);
      syncFiltersFromUi({ resetPages: true });
    } catch (e) {
      state.data = null;
      const code = e && e.code ? String(e.code) : "PARSE_FAILED";
      const msg = e && e.message ? String(e.message) : "Failed to parse MIDI.";
      setError(`${code}: ${msg}`);
      setStatus("");
      if (summaryEl) summaryEl.style.display = "none";
      if (filtersEl) filtersEl.style.display = "none";
      if (tabsEl) tabsEl.style.display = "none";
      if (exportEl) exportEl.style.display = "none";
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(file) {
    state.file = file || null;
    state.fileKey = file ? getFileIdentityKey(file) : "";
    state.bytes = null;
    state.data = null;
    state.noteEventsLoaded = false;
    state.showNoteEvents = false;
    if (eventsShowNotesEl) eventsShowNotesEl.checked = false;
    if (fileInfo) fileInfo.textContent = file ? `${file.name} · ${bytesToHuman(file.size)}` : "No file selected";
    setError("");
    setStatus("");
    setBusy(false);
    resetFilters();

    if (!file) {
      if (summaryEl) summaryEl.style.display = "none";
      if (filtersEl) filtersEl.style.display = "none";
      if (tabsEl) tabsEl.style.display = "none";
      if (exportEl) exportEl.style.display = "none";
      if (inspectBtn) inspectBtn.disabled = true;
      if (clearBtn) clearBtn.disabled = true;
      return;
    }

    setBusy(true);
    setStatus("Reading file…");
    await yieldToMainThread();

    try {
      const buf = await file.arrayBuffer();
      state.bytes = new Uint8Array(buf);
      setStatus("Ready. Click Inspect.");
      if (inspectBtn) inspectBtn.disabled = false;
      if (clearBtn) clearBtn.disabled = false;
    } catch (e) {
      setError("Failed to read file.");
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    fileInput.value = "";
    loadFile(null);
  }

  async function handleIncomingFiles(fileList) {
    if (state.parsing) {
      setStatus("Parsing in progress. Please wait for completion.");
      return;
    }

    const allFiles = Array.from(fileList || []);
    if (!allFiles.length) return;

    const midiFiles = allFiles.filter((f) => isMidiFile(f));
    if (!midiFiles.length) {
      setError("Please select a valid MIDI file (.mid/.midi).");
      setStatus("");
      if (fileInput) fileInput.value = "";
      return;
    }

    if (midiFiles.length > 1) {
      setStatus("MIDI Inspector supports one file only. Using the first file.");
    }

    const nextFile = midiFiles[0];
    const nextKey = getFileIdentityKey(nextFile);
    if (state.fileKey && state.fileKey === nextKey && state.bytes) {
      setStatus("This file is already loaded.");
      if (fileInput) fileInput.value = "";
      return;
    }

    await loadFile(nextFile);
    if (fileInput) fileInput.value = "";
  }

  async function onInspect() {
    state.activeTab = "events";
    state.eventsPage = 1;
    state.notesPage = 1;
    await parseAndRender({ includeNoteEvents: false });
  }

  async function onToggleNoteEvents() {
    const next = !!(eventsShowNotesEl && eventsShowNotesEl.checked);
    if (next === state.showNoteEvents) return;
    state.showNoteEvents = next;
    state.eventsPage = 1;
    if (state.showNoteEvents) {
      state.eventTypeSet.add("noteOn");
      state.eventTypeSet.add("noteOff");
    } else {
      state.eventTypeSet.delete("noteOn");
      state.eventTypeSet.delete("noteOff");
    }
    renderEventTypeFilter();

    if (state.showNoteEvents && !state.noteEventsLoaded) {
      // On-demand re-parse to include note events (can be large).
      setStatus("Loading noteOn/noteOff events…");
      await parseAndRender({ includeNoteEvents: true });
      return;
    }
    renderEventsTab();
  }

  function renderEventTypeFilter() {
    if (!eventsTypeFilterEl) return;
    const types = [
      { kind: "tempo", label: "tempo" },
      { kind: "timeSig", label: "timeSig" },
      { kind: "program", label: "program" },
      { kind: "cc", label: "cc" },
      { kind: "noteOn", label: "noteOn" },
      { kind: "noteOff", label: "noteOff" },
    ];
    eventsTypeFilterEl.innerHTML = types
      .map((t) => {
        const disabled = !state.showNoteEvents && (t.kind === "noteOn" || t.kind === "noteOff");
        const checked = state.eventTypeSet.has(t.kind);
        return `<label class="inspector-check"><input type="checkbox" data-kind="${escapeHtml(t.kind)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}/> ${escapeHtml(t.label)}</label>`;
      })
      .join("");

    eventsTypeFilterEl.querySelectorAll('input[type="checkbox"][data-kind]').forEach((el) => {
      el.addEventListener("change", () => {
        const kind = el.getAttribute("data-kind");
        if (!kind) return;
        if (el.checked) state.eventTypeSet.add(kind);
        else state.eventTypeSet.delete(kind);
        state.eventsPage = 1;
        renderEventsTab();
      });
    });
  }

  function updateProState() {
    state.isPro = getIsPro();
    renderSummary();
    renderFilters();
    renderExportMeta();
    syncFiltersFromUi({ resetPages: true });
  }

  function exportReport() {
    if (!state.data) return;
    const report = buildInspectorReport({
      data: state.data,
      isPro: state.isPro,
      toolVersion: TOOL_VERSION,
      fileName: state.file ? state.file.name : null,
      fileBytes: state.file ? state.file.size : null,
    });
    downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), "report.json");
  }

  function exportNotesCsv() {
    if (!state.data) return;
    const tempo = state.data.tempo || {};
    const includeSeconds = state.data.fileMeta.divisionType === "PPQ" && !!tempo.tempoMapReady;

    if (!state.isPro && state.data.notes.length > FREE_EXPORT_NOTES_HARD_LIMIT) {
      setError(`File too large for Free export (${state.data.notes.length} notes). Upgrade to Pro to export filtered results.`);
      expandProPanel();
      return;
    }

    const notes = state.isPro ? filterNotes(state.data.notes, currentFilters()) : state.data.notes;
    const csv = notesToInspectorCsv({ notes, includeSeconds });
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "notes.csv");
  }

  function exportEventsJson() {
    if (!state.data) return;
    if (!state.isPro) {
      expandProPanel();
      return;
    }
    const eventsFiltered = filterEvents(state.data.events, currentFilters({ forEvents: true }))
      .filter((e) => e.kind !== "noteOn" && e.kind !== "noteOff");
    const out = buildEventsJson({ events: eventsFiltered });
    downloadBlob(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), "events.json");
  }

  // --- events wiring ---
  fileInput.addEventListener("change", (e) => {
    const files = e.target && e.target.files ? e.target.files : null;
    void handleIncomingFiles(files);
  });

  dropArea.addEventListener("click", () => {
    if (state.parsing) {
      setStatus("Parsing in progress. Please wait for completion.");
      return;
    }
    fileInput.click();
  });
  dropArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (state.parsing) {
        setStatus("Parsing in progress. Please wait for completion.");
        return;
      }
      fileInput.click();
    }
  });

  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("dragover");
  });
  dropArea.addEventListener("dragleave", () => dropArea.classList.remove("dragover"));
  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.classList.remove("dragover");
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    void handleIncomingFiles(files);
  });

  if (inspectBtn) inspectBtn.addEventListener("click", onInspect);
  if (clearBtn) clearBtn.addEventListener("click", clearAll);

  if (resetFiltersBtn) resetFiltersBtn.addEventListener("click", resetFilters);

  // Filters
  [trackSelect, channelSelect, pitchMinEl, pitchMaxEl, tickStartEl, tickEndEl, flagOverlapEl, flagDanglingEl, flagVelocity0El].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", () => syncFiltersFromUi({ resetPages: true }));
    el.addEventListener("input", () => syncFiltersFromUi({ resetPages: true }));
  });

  // Tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (!tab) return;
      setActiveTab(tab);
    });
  });

  // Events controls
  if (eventsShowNotesEl) eventsShowNotesEl.addEventListener("change", onToggleNoteEvents);
  if (eventsCc64OnlyEl) {
    eventsCc64OnlyEl.addEventListener("change", () => {
      state.cc64Only = !!eventsCc64OnlyEl.checked;
      state.eventsPage = 1;
      renderEventsTab();
    });
  }

  // Pagination handlers
  if (eventsPagerEl) {
    eventsPagerEl.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("button[data-action]") : null;
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "prev") state.eventsPage = Math.max(1, state.eventsPage - 1);
      if (action === "next") state.eventsPage = state.eventsPage + 1;
      renderEventsTab();
    });
  }
  if (notesPagerEl) {
    notesPagerEl.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("button[data-action]") : null;
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "prev") state.notesPage = Math.max(1, state.notesPage - 1);
      if (action === "next") state.notesPage = state.notesPage + 1;
      renderNotesTab();
    });
  }

  // Export
  if (exportReportBtn) exportReportBtn.addEventListener("click", exportReport);
  if (exportNotesBtn) exportNotesBtn.addEventListener("click", exportNotesCsv);
  if (exportEventsBtn) exportEventsBtn.addEventListener("click", exportEventsJson);

  // Pro state updates
  globalThis.addEventListener("midieasy:pro-changed", updateProState);

  // Initial render
  setActiveTab("events");
  renderEventTypeFilter();
  renderProHints();
  setBusy(false);
}

wireMidiInspectorPage();
