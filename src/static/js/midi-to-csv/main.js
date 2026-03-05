import JSZip from "jszip";
import { parseMidi } from "midi-file";

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

function makeId() {
  return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `job-${Date.now()}-${Math.random()}`;
}

function getFileIdentityKey(file) {
  const lastModified = typeof file.lastModified === "number" ? file.lastModified : 0;
  return `${file.name}::${file.size}::${lastModified}`;
}

function basenameNoExt(name) {
  const s = String(name || "file");
  const lastSlash = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
  const base = lastSlash >= 0 ? s.slice(lastSlash + 1) : s;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return base || "file";
  return base.slice(0, dot);
}

function sanitizeFileName(name) {
  return String(name || "file").replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 140) || "file";
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
  // Fixed precision, but trim trailing zeros.
  const s = sec.toFixed(6);
  return s.replace(/\.?0+$/, "");
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[,"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function encodeCsv(text) {
  return new TextEncoder().encode(text);
}

function isSmpteDivision(divisionOrHeader) {
  // midi-file exposes header.ticksPerBeat for PPQ. Anything else is considered unsupported for v0.1.
  const ppq = divisionOrHeader && typeof divisionOrHeader.ticksPerBeat === "number"
    ? divisionOrHeader.ticksPerBeat
    : (typeof divisionOrHeader === "number" ? divisionOrHeader : null);
  return !ppq || ppq <= 0;
}

function priorityForNormalized(event) {
  if (!event) return 100;
  if (event.kind === "tempo") return 10;
  if (event.kind === "program") return 11;
  if (event.kind === "cc") return 12;
  if (event.kind === "noteOff") return 20;
  if (event.kind === "noteOn") return 30;
  return 100;
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;

  // Notes
  if (raw.type === "noteOn") {
    const vel = raw.velocity ?? 0;
    if (vel === 0) {
      return { kind: "noteOff", channel: raw.channel, pitch: raw.noteNumber, velocity: 0, velocity0: true };
    }
    return { kind: "noteOn", channel: raw.channel, pitch: raw.noteNumber, velocity: vel };
  }
  if (raw.type === "noteOff") {
    return { kind: "noteOff", channel: raw.channel, pitch: raw.noteNumber, velocity: raw.velocity ?? 0, velocity0: false };
  }

  // Program change
  if (raw.type === "programChange") {
    return { kind: "program", channel: raw.channel, program: raw.programNumber ?? 0 };
  }

  // Control change
  if (raw.type === "controller") {
    return { kind: "cc", channel: raw.channel, controller: raw.controllerType ?? raw.controllerNumber ?? raw.controller ?? 0, value: raw.value ?? 0 };
  }

  // Meta events (tempo, track name)
  if (raw.type === "meta") {
    if (raw.subtype === "setTempo") {
      return { kind: "tempo", microsecondsPerBeat: raw.microsecondsPerBeat ?? raw.tempo ?? null };
    }
    if (raw.subtype === "trackName") {
      return { kind: "trackName", text: raw.text ?? "" };
    }
  }

  // Some variants use top-level types for meta.
  if (raw.type === "setTempo") {
    return { kind: "tempo", microsecondsPerBeat: raw.microsecondsPerBeat ?? raw.tempo ?? null };
  }
  if (raw.type === "trackName") {
    return { kind: "trackName", text: raw.text ?? "" };
  }

  return null;
}

function buildTempoIndex({ ppq, tempoEvents }) {
  const DEFAULT_US_PER_BEAT = 500000; // 120 BPM
  const events = Array.isArray(tempoEvents) ? tempoEvents.slice() : [];
  events.sort((a, b) => a.tick - b.tick);

  const cleaned = [];
  for (const e of events) {
    const tick = Number(e.tick);
    const uspb = Number(e.microsecondsPerBeat);
    if (!Number.isFinite(tick) || tick < 0) continue;
    if (!Number.isFinite(uspb) || uspb <= 0) continue;
    if (cleaned.length && cleaned[cleaned.length - 1].tick === tick) {
      cleaned[cleaned.length - 1].microsecondsPerBeat = uspb;
    } else {
      cleaned.push({ tick, microsecondsPerBeat: uspb });
    }
  }

  if (!cleaned.length || cleaned[0].tick !== 0) {
    cleaned.unshift({ tick: 0, microsecondsPerBeat: DEFAULT_US_PER_BEAT });
  }

  const segments = [];
  let cumSec = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const curr = cleaned[i];
    const prev = cleaned[i - 1];
    if (prev) {
      const prevUsPerTick = prev.microsecondsPerBeat / (ppq * 1_000_000);
      cumSec += (curr.tick - prev.tick) * prevUsPerTick;
    }
    segments.push({
      tick: curr.tick,
      microsecondsPerBeat: curr.microsecondsPerBeat,
      cumSecondsAtTick: cumSec,
      usPerTick: curr.microsecondsPerBeat / (ppq * 1_000_000),
    });
  }

  function tickToSeconds(tick) {
    const t = Number(tick);
    if (!Number.isFinite(t) || t < 0) return 0;
    // Find rightmost segment with seg.tick <= t
    let lo = 0;
    let hi = segments.length - 1;
    let idx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid].tick <= t) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const seg = segments[idx];
    return seg.cumSecondsAtTick + (t - seg.tick) * seg.usPerTick;
  }

  return { segments, tickToSeconds, tempoEventsCount: cleaned.length, hasTempoChanges: cleaned.length > 1 };
}

class MinHeap {
  constructor(compare) {
    this.arr = [];
    this.compare = compare;
  }
  size() { return this.arr.length; }
  push(x) {
    const a = this.arr;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop() {
    const a = this.arr;
    if (!a.length) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < a.length && this.compare(a[l], a[smallest]) < 0) smallest = l;
        if (r < a.length && this.compare(a[r], a[smallest]) < 0) smallest = r;
        if (smallest === i) break;
        [a[i], a[smallest]] = [a[smallest], a[i]];
        i = smallest;
      }
    }
    return top;
  }
}

async function extractNotesFromMidiBytes(midiBytes) {
  const parsed = parseMidi(midiBytes);
  const header = parsed && parsed.header ? parsed.header : null;
  if (!header || isSmpteDivision(header)) {
    const err = new Error("Unsupported time division (SMPTE)");
    err.code = "UNSUPPORTED_TIME_DIVISION";
    throw err;
  }

  const ppq = header.ticksPerBeat;
  const tracks = Array.isArray(parsed.tracks) ? parsed.tracks : [];
  const tracksCount = tracks.length;

  // Pre-scan each track: absolute ticks, normalize, first trackName, trackEndTick
  const trackStreams = [];
  const trackNameByIndex = new Array(tracksCount).fill("");
  const trackEndTickByIndex = new Array(tracksCount).fill(0);
  let unknownEventCount = 0;
  let scannedCount = 0;

  for (let trackIndex = 0; trackIndex < tracksCount; trackIndex++) {
    const rawEvents = tracks[trackIndex] || [];
    let absTick = 0;
    const stream = [];
    let firstTrackName = "";
    for (let eventOrder = 0; eventOrder < rawEvents.length; eventOrder++) {
      const raw = rawEvents[eventOrder];
      absTick += Number(raw.deltaTime || 0);
      const normalized = normalizeEvent(raw);
      if (!normalized) {
        if (!raw || !raw.meta) unknownEventCount += 1;
        continue;
      }
      if (normalized.kind === "trackName") {
        if (!firstTrackName) firstTrackName = String(normalized.text || "");
        continue; // Track name is captured, not part of the global event stream.
      }
      stream.push({
        tick: absTick,
        trackIndex,
        eventOrder,
        normalized,
        priority: priorityForNormalized(normalized),
      });

      scannedCount += 1;
      if (scannedCount % 5000 === 0) await yieldToMainThread();
    }
    trackNameByIndex[trackIndex] = firstTrackName;
    trackEndTickByIndex[trackIndex] = absTick;
    trackStreams.push(stream);
  }

  // k-way merge into a global event stream on demand
  const heap = new MinHeap((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.trackIndex !== b.trackIndex) return a.trackIndex - b.trackIndex;
    return a.eventOrder - b.eventOrder;
  });

  const cursorByTrack = new Array(tracksCount).fill(0);
  for (let i = 0; i < tracksCount; i++) {
    if (trackStreams[i] && trackStreams[i].length) heap.push(trackStreams[i][0]);
  }

  function nextGlobalEvent() {
    const node = heap.pop();
    if (!node) return null;
    const { trackIndex } = node;
    cursorByTrack[trackIndex] += 1;
    const nextIdx = cursorByTrack[trackIndex];
    const stream = trackStreams[trackIndex];
    if (stream && nextIdx < stream.length) heap.push(stream[nextIdx]);
    return node;
  }

  const programByChannel = new Array(16).fill(0);
  let hasSustainPedalEvents = false;
  const tempoEvents = [];

  // active[trackIndex][channel][pitch] -> stack
  const active = Array.from({ length: tracksCount }, () =>
    Array.from({ length: 16 }, () => Array.from({ length: 128 }, () => []))
  );

  let overlapCount = 0;
  let orphanOffCount = 0;
  let danglingCount = 0;
  const sampleErrors = [];

  const notes = [];

  let mergedCount = 0;
  while (true) {
    const ev = nextGlobalEvent();
    if (!ev) break;
    const { tick, trackIndex, normalized } = ev;
    mergedCount += 1;
    if (mergedCount % 5000 === 0) await yieldToMainThread();

    if (normalized.kind === "tempo") {
      tempoEvents.push({ tick, microsecondsPerBeat: normalized.microsecondsPerBeat });
      continue;
    }

    if (normalized.kind === "program") {
      const ch = normalized.channel ?? 0;
      if (ch >= 0 && ch < 16) programByChannel[ch] = normalized.program ?? 0;
      continue;
    }

    if (normalized.kind === "cc") {
      const controller = normalized.controller ?? 0;
      if (controller === 64) hasSustainPedalEvents = true;
      continue;
    }

    if (normalized.kind === "noteOn") {
      const ch = normalized.channel ?? 0;
      const pitch = normalized.pitch ?? 0;
      const vel = normalized.velocity ?? 0;
      if (ch < 0 || ch > 15 || pitch < 0 || pitch > 127) continue;

      const stack = active[trackIndex][ch][pitch];
      if (stack.length > 0) overlapCount += 1;
      stack.push({
        startTick: tick,
        velocity: vel,
        programAtStart: programByChannel[ch] ?? 0,
        overlapAtStart: stack.length > 0,
      });
      continue;
    }

    if (normalized.kind === "noteOff") {
      const ch = normalized.channel ?? 0;
      const pitch = normalized.pitch ?? 0;
      if (ch < 0 || ch > 15 || pitch < 0 || pitch > 127) continue;

      const stack = active[trackIndex][ch][pitch];
      const start = stack.pop();
      if (!start) {
        orphanOffCount += 1;
        if (sampleErrors.length < 3) {
          sampleErrors.push({ type: "ORPHAN_OFF", tick, track: trackIndex, ch, pitch });
        }
        continue;
      }
      const endTick = tick;
      const durationTicks = endTick - start.startTick;
      if (durationTicks < 0) {
        const err = new Error("Negative duration (bad pairing/order)");
        err.code = "PARSE_ERROR";
        throw err;
      }
      notes.push({
        track_index: trackIndex,
        track_name: trackNameByIndex[trackIndex] || "",
        channel: ch,
        pitch,
        velocity: start.velocity,
        start_ticks: start.startTick,
        end_ticks: endTick,
        duration_ticks: durationTicks,
        program: start.programAtStart,
        flags: {
          overlap: !!start.overlapAtStart,
          velocity0_noteoff: !!normalized.velocity0,
          dangling: false,
        },
      });
      continue;
    }

  }

  // Close dangling notes per track end tick
  for (let trackIndex = 0; trackIndex < tracksCount; trackIndex++) {
    const trackEndTick = trackEndTickByIndex[trackIndex] || 0;
    for (let ch = 0; ch < 16; ch++) {
      for (let pitch = 0; pitch < 128; pitch++) {
        const stack = active[trackIndex][ch][pitch];
        while (stack.length) {
          const start = stack.pop();
          danglingCount += 1;
          const endTick = trackEndTick;
          const durationTicks = endTick - start.startTick;
          if (durationTicks < 0) continue;
          notes.push({
            track_index: trackIndex,
            track_name: trackNameByIndex[trackIndex] || "",
            channel: ch,
            pitch,
            velocity: start.velocity,
            start_ticks: start.startTick,
            end_ticks: endTick,
            duration_ticks: durationTicks,
            program: start.programAtStart,
            flags: {
              overlap: !!start.overlapAtStart,
              velocity0_noteoff: false,
              dangling: true,
              forced_end_tick: endTick,
            },
          });
        }
      }
    }
  }

  // Derive seconds with tempo map (v0.1 required)
  const tempoIndex = buildTempoIndex({ ppq, tempoEvents });
  for (const n of notes) {
    const s0 = tempoIndex.tickToSeconds(n.start_ticks);
    const s1 = tempoIndex.tickToSeconds(n.end_ticks);
    n.start_seconds = s0;
    n.end_seconds = s1;
    n.duration_seconds = Math.max(0, s1 - s0);
  }

  return {
    notes,
    fileMeta: {
      ppq,
      tracksCount,
      notesCount: notes.length,
      tempoEventsCount: tempoIndex.tempoEventsCount,
      hasTempoChanges: tempoIndex.hasTempoChanges,
      hasSustainPedalEvents,
      unknownEventCount,
      overlapCount,
      danglingCount,
      orphanOffCount,
      sampleErrors,
    },
  };
}

function notesToCsv(notes) {
  const header = ["track", "channel", "pitch", "note_name", "start_seconds", "duration_seconds", "velocity"];
  const lines = [header.join(",")];

  for (const n of notes) {
    const row = [
      // Export is 1-based track index
      csvEscape((Number(n.track_index) + 1).toString()),
      csvEscape(String(n.channel ?? "")),
      csvEscape(String(n.pitch ?? "")),
      csvEscape(pitchToName(n.pitch)),
      csvEscape(formatSeconds(n.start_seconds)),
      csvEscape(formatSeconds(n.duration_seconds)),
      csvEscape(String(n.velocity ?? "")),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n") + "\n";
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

function setStatus(el, text, { color } = {}) {
  if (!el) return;
  el.textContent = text || "";
  if (color) el.style.color = color;
  else el.style.color = "";
}

function updateProgressBar(bar, done, total) {
  if (!bar) return;
  if (!total) {
    bar.style.width = "0%";
    return;
  }
  const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  bar.style.width = `${pct}%`;
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

function buildReport({ jobs, isPro, globalMeta }) {
  if (!isPro) return null;
  const nowIso = new Date().toISOString();
  const report = {
    generatedAt: nowIso,
    tool: "midi-to-csv",
    version: "v0.1",
    isPro: true,
    ...globalMeta,
    files: jobs.map((j) => ({
      fileName: j.fileName,
      fileBytes: j.fileSize,
      status: j.status === "done" ? "ok" : (j.status === "failed" ? "fail" : j.status),
      durationMs: j.durationMs ?? null,
      notesCount: j.notesCount ?? 0,
      tracksCount: j.tracksCount ?? 0,
      ppq: j.ppq ?? null,
      tempoEventsCount: j.tempoEventsCount ?? null,
      hasTempoChanges: j.hasTempoChanges ?? null,
      hasSustainPedalEvents: j.hasSustainPedalEvents ?? null,
      overlapCount: j.overlapCount ?? 0,
      danglingCount: j.danglingCount ?? 0,
      orphanOffCount: j.orphanOffCount ?? 0,
      sampleErrors: Array.isArray(j.sampleErrors) ? j.sampleErrors : [],
      errorCode: j.errorCode || "",
      errorMessage: j.errorMessage || "",
      attempt: j.attempt ?? 0,
    })),
  };
  return report;
}

function uniqueCsvName(baseName, used) {
  let name = sanitizeFileName(baseName);
  if (!name.toLowerCase().endsWith(".csv")) name += ".csv";
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const stem = name.replace(/\.csv$/i, "");
  let i = 2;
  while (true) {
    const next = `${stem} (${i}).csv`;
    if (!used.has(next)) {
      used.add(next);
      return next;
    }
    i += 1;
  }
}

function wireMidiToCsvPage() {
  const fileInput = document.querySelector("#csv-file-input");
  const dropArea = document.querySelector("#csv-drop-area");
  const fileInfo = document.querySelector("#csv-file-info");
  const limitInfo = document.querySelector("#csv-limit-info");
  const limitError = document.querySelector("#csv-limit-error");
  const convertBtn = document.querySelector("#csv-convert-btn");
  const zipBtn = document.querySelector("#csv-download-zip-btn");
  const reportBtn = document.querySelector("#csv-download-report-btn");
  const retryAllBtn = document.querySelector("#csv-retry-all-btn");
  const clearBtn = document.querySelector("#csv-clear-btn");
  const zipProHintEl = document.querySelector("#csv-zip-pro-hint");
  const zipProBuyBtn = document.querySelector("#csv-zip-pro-buy-btn");
  const zipProFeaturesBtn = document.querySelector("#csv-zip-pro-features-btn");
  const zipProCloseBtn = document.querySelector("#csv-zip-pro-close-btn");
  const batchBox = document.querySelector("#csv-batch-status");
  const fileList = document.querySelector("#csv-file-list");
  const processedCountEl = document.querySelector("#csv-processed-count");
  const totalCountEl = document.querySelector("#csv-total-count");
  const concurrencyEl = document.querySelector("#csv-batch-concurrency");
  const statusEl = document.querySelector("#status-message");
  const progressBar = document.querySelector("#csv-progress-bar");

  if (!fileInput || !dropArea || !convertBtn) return;

  const HARD_MAX_FILES = 20;
  const HARD_MAX_BYTES = 100 * 1024 * 1024;

  const SOFT_MAX_FILES = 200;
  const SOFT_MAX_BYTES = 1024 * 1024 * 1024;
  const ZIP_HINT_SESSION_KEY = "midieasy_csv_zip_hint_shown";
  const ZIP_HINT_AUTO_HIDE_MS = 8000;

  const state = {
    isPro: getIsPro(),
    running: false,
    jobs: [],
    totalBytes: 0,
    processed: 0,
    success: 0,
    failed: 0,
    maxConcurrency: 1,
  };
  let zipHintHideTimer = 0;

  function pushDataLayerEvent(eventName, params = {}) {
    const payload = {
      event: eventName,
      tool_page: "midi_to_csv",
      user_tier: state.isPro ? "pro" : "free",
      file_count: state.jobs.length,
      ...params,
    };
    try {
      globalThis.dataLayer = globalThis.dataLayer || [];
      globalThis.dataLayer.push(payload);
    } catch {
      // no-op
    }
  }

  function hasSeenZipHintThisSession() {
    try {
      return sessionStorage.getItem(ZIP_HINT_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markZipHintSeenThisSession() {
    try {
      sessionStorage.setItem(ZIP_HINT_SESSION_KEY, "1");
    } catch {
      // no-op
    }
  }

  function clearZipHintHideTimer() {
    if (!zipHintHideTimer) return;
    clearTimeout(zipHintHideTimer);
    zipHintHideTimer = 0;
  }

  function hideZipProHint() {
    if (!zipProHintEl) return;
    clearZipHintHideTimer();
    zipProHintEl.style.display = "none";
  }

  function showZipProHint() {
    if (!zipProHintEl) return;
    clearZipHintHideTimer();
    zipProHintEl.style.display = "flex";
    zipHintHideTimer = setTimeout(() => {
      zipProHintEl.style.display = "none";
      zipHintHideTimer = 0;
    }, ZIP_HINT_AUTO_HIDE_MS);
  }

  function maybeShowZipProHint() {
    if (!zipProHintEl) return;
    if (state.isPro) return;
    if (hasSeenZipHintThisSession()) return;
    markZipHintSeenThisSession();
    showZipProHint();
    pushDataLayerEvent("zip_hint_view", { trigger_source: "zip_download" });
  }

  function navigateWithTrackedEvent(event, { eventName, href, extraParams = {} }) {
    if (!href) return;
    event.preventDefault();
    let navigated = false;
    const go = () => {
      if (navigated) return;
      navigated = true;
      globalThis.location.href = href;
    };
    pushDataLayerEvent(eventName, {
      ...extraParams,
      eventCallback: go,
      eventTimeout: 1000,
    });
    setTimeout(go, 150);
  }

  function isMidiFile(file) {
    const name = (file && file.name) ? String(file.name).toLowerCase() : "";
    return name.endsWith(".mid") || name.endsWith(".midi");
  }

  function buildJob(file) {
    return {
      id: makeId(),
      file,
      fileName: file.name,
      fileSize: file.size,
      status: "waiting",
      attempt: 0,
      csvBlob: null,
      csvByteLength: 0,
      durationMs: null,
      notesCount: 0,
      tracksCount: 0,
      ppq: null,
      tempoEventsCount: null,
      hasTempoChanges: null,
      hasSustainPedalEvents: null,
      overlapCount: 0,
      danglingCount: 0,
      orphanOffCount: 0,
      sampleErrors: [],
      errorCode: "",
      errorMessage: "",
    };
  }

  function recalcTotalBytes() {
    state.totalBytes = state.jobs.reduce((sum, j) => sum + (j.fileSize || 0), 0);
  }

  function setJobsFromFiles(files) {
    state.running = false;
    state.jobs = files.map((f) => buildJob(f));
    recalcTotalBytes();
    recomputeSummary();
  }

  function appendJobs(files) {
    state.jobs.push(...files.map((f) => buildJob(f)));
    recalcTotalBytes();
    recomputeSummary();
  }

  function hasWaitingJobs() {
    return state.jobs.some((j) => j.status === "waiting");
  }

  function hasProcessableJobs() {
    return state.jobs.some((j) => j.status === "waiting" || j.status === "failed");
  }

  function allJobsProcessed() {
    return state.jobs.length > 0 && state.jobs.every((j) => j.status === "done" || j.status === "failed");
  }

  function getSelectionMode() {
    if (!state.jobs.length) return "overwrite";
    return hasWaitingJobs() ? "append" : "overwrite";
  }

  function resetJobForProcessing(job, { bumpAttempt = false } = {}) {
    if (bumpAttempt) job.attempt += 1;
    job.status = "waiting";
    job.csvBlob = null;
    job.csvByteLength = 0;
    job.durationMs = null;
    job.notesCount = 0;
    job.tracksCount = 0;
    job.ppq = null;
    job.tempoEventsCount = null;
    job.hasTempoChanges = null;
    job.hasSustainPedalEvents = null;
    job.overlapCount = 0;
    job.danglingCount = 0;
    job.orphanOffCount = 0;
    job.sampleErrors = [];
    job.errorCode = "";
    job.errorMessage = "";
  }

  function recomputeSummary() {
    let success = 0;
    let failed = 0;
    for (const j of state.jobs) {
      if (j.status === "done") success += 1;
      else if (j.status === "failed") failed += 1;
    }
    state.success = success;
    state.failed = failed;
    state.processed = success + failed;
  }

  function applyProToUi() {
    state.isPro = getIsPro();
    state.maxConcurrency = state.isPro ? 3 : 1;

    if (concurrencyEl) concurrencyEl.textContent = `Concurrent workers: ${state.maxConcurrency}`;

    if (limitInfo) {
      limitInfo.innerHTML = `<i class="fas fa-info-circle"></i> ${state.isPro
        ? `Pro: no hard limits. Soft cap warning at ${SOFT_MAX_FILES} files / ${bytesToHuman(SOFT_MAX_BYTES)}.`
        : `Free: up to ${HARD_MAX_FILES} files / ${bytesToHuman(HARD_MAX_BYTES)} total.`}`;
    }

    // Pro-only actions
    if (reportBtn) reportBtn.disabled = !state.isPro || !state.jobs.length || state.running;
    if (retryAllBtn) retryAllBtn.disabled = !state.isPro || !state.jobs.some((j) => j.status === "failed") || state.running;
  }

  function renderList() {
    if (!fileList) return;
    fileList.innerHTML = "";
    for (const job of state.jobs) {
      const item = document.createElement("div");
      item.className = "file-item";

      const name = document.createElement("div");
      name.className = "file-name";
      name.title = job.fileName;
      name.textContent = job.fileName;

      const status = document.createElement("div");
      status.className = "file-status";

      const icon = document.createElement("span");
      icon.className = "status-icon";
      const label = document.createElement("span");

      if (job.status === "waiting") {
        icon.classList.add("status-pending");
        icon.innerHTML = '<i class="fas fa-clock"></i>';
        label.textContent = "waiting";
      } else if (job.status === "processing") {
        icon.classList.add("status-processing");
        icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        label.textContent = "processing";
      } else if (job.status === "done") {
        icon.classList.add("status-success");
        icon.innerHTML = '<i class="fas fa-circle-check"></i>';
        label.textContent = "done";
      } else if (job.status === "failed") {
        icon.classList.add("status-error");
        icon.innerHTML = '<i class="fas fa-circle-xmark"></i>';
        label.textContent = "failed";
      } else {
        icon.classList.add("status-pending");
        icon.innerHTML = '<i class="fas fa-circle"></i>';
        label.textContent = job.status;
      }

      status.appendChild(icon);
      status.appendChild(label);

      const actions = document.createElement("div");
      actions.className = "csv-file-actions";

      const dl = document.createElement("button");
      dl.className = "btn btn-sm primary-btn";
      dl.textContent = "Download";
      dl.disabled = job.status !== "done" || !job.csvBlob;
      dl.addEventListener("click", () => {
        if (!job.csvBlob) return;
        downloadBlob(job.csvBlob, `${sanitizeFileName(basenameNoExt(job.fileName))}.csv`);
      });

      const retry = document.createElement("button");
      retry.className = "retry-btn";
      retry.textContent = "Retry";
      retry.disabled = !state.isPro || job.status !== "failed" || state.running;
      retry.title = state.isPro ? "" : "Pro only";
      retry.addEventListener("click", () => {
        if (!state.isPro) {
          expandProPanel();
          return;
        }
        retryJob(job.id);
      });

      actions.appendChild(dl);
      if (job.status === "failed") actions.appendChild(retry);

      const right = document.createElement("div");
      right.className = "csv-file-right";
      right.appendChild(status);
      if (job.status === "failed" && job.errorMessage) {
        const err = document.createElement("div");
        err.style.color = "#e74c3c";
        err.style.fontSize = "0.85rem";
        err.style.maxWidth = "360px";
        err.style.whiteSpace = "nowrap";
        err.style.overflow = "hidden";
        err.style.textOverflow = "ellipsis";
        err.title = job.errorMessage;
        err.textContent = job.errorMessage;
        right.appendChild(err);
      }

      item.appendChild(name);
      item.appendChild(right);
      item.appendChild(actions);
      fileList.appendChild(item);
    }
  }

  function validateLimits(files, { totalBytes } = {}) {
    if (!limitError) return { ok: true };
    limitError.style.display = "none";
    limitError.textContent = "";
    const arr = Array.from(files || []);
    if (!arr.length) return { ok: true };
    const bytes = Number.isFinite(totalBytes) ? totalBytes : arr.reduce((sum, f) => sum + ((f && f.size) || 0), 0);

    if (!state.isPro) {
      if (arr.length > HARD_MAX_FILES || bytes > HARD_MAX_BYTES) {
        const msg = `Free limit exceeded: ${arr.length} files / ${bytesToHuman(bytes)}. Upgrade to Pro.`;
        limitError.textContent = msg;
        limitError.style.display = "block";
        return { ok: false, hardBlocked: true };
      }
    }
    return { ok: true };
  }

  function updateTopUi() {
    recomputeSummary();
    if (fileInfo) {
      if (!state.jobs.length) fileInfo.textContent = "No files selected";
      else fileInfo.textContent = `${state.jobs.length} file(s) selected — ${bytesToHuman(state.totalBytes)}`;
    }

    if (totalCountEl) totalCountEl.textContent = String(state.jobs.length);
    if (processedCountEl) processedCountEl.textContent = String(state.processed);
    updateProgressBar(progressBar, state.processed, state.jobs.length);

    if (batchBox) batchBox.style.display = state.jobs.length ? "block" : "none";

    const files = state.jobs.map((j) => j.file);
    validateLimits(files, { totalBytes: state.totalBytes });
    // Keep Convert clickable even when Free exceeds hard limits so we can show the "hard block + expand Pro panel" flow.
    convertBtn.disabled = state.running || !hasProcessableJobs();
    zipBtn.disabled = state.running || state.success === 0 || !allJobsProcessed();

    if (reportBtn) reportBtn.disabled = !state.isPro || state.running || state.jobs.length === 0;
    if (retryAllBtn) retryAllBtn.disabled = !state.isPro || state.running || !state.jobs.some((j) => j.status === "failed");
  }

  async function processJob(job) {
    const startedAt = performance.now();
    job.status = "processing";
    job.errorCode = "";
    job.errorMessage = "";
    job.csvBlob = null;
    job.csvByteLength = 0;
    job.sampleErrors = [];
    renderList();

    try {
      await yieldToMainThread();
      const ab = await job.file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      const { notes, fileMeta } = await extractNotesFromMidiBytes(bytes);

      const csvText = notesToCsv(notes);
      const csvBytes = encodeCsv(csvText);
      const blob = new Blob([csvBytes], { type: "text/csv" });

      job.csvBlob = blob;
      job.csvByteLength = csvBytes.byteLength;
      job.durationMs = Math.round(performance.now() - startedAt);
      job.notesCount = fileMeta.notesCount;
      job.tracksCount = fileMeta.tracksCount;
      job.ppq = fileMeta.ppq;
      job.tempoEventsCount = fileMeta.tempoEventsCount;
      job.hasTempoChanges = fileMeta.hasTempoChanges;
      job.hasSustainPedalEvents = fileMeta.hasSustainPedalEvents;
      job.overlapCount = fileMeta.overlapCount;
      job.danglingCount = fileMeta.danglingCount;
      job.orphanOffCount = fileMeta.orphanOffCount;
      job.sampleErrors = fileMeta.sampleErrors || [];

      job.status = "done";
    } catch (e) {
      const code = e && typeof e === "object" ? (e.code || e.name) : "";
      job.errorCode = String(code || "PARSE_ERROR");
      job.errorMessage = (e && e.message) ? String(e.message) : "Parse failed";
      job.durationMs = Math.round(performance.now() - startedAt);
      job.status = "failed";
    } finally {
      recomputeSummary();
      if (processedCountEl) processedCountEl.textContent = String(state.processed);
      updateProgressBar(progressBar, state.processed, state.jobs.length);
      renderList();
    }
  }

  function prepareFailedJobsForConvert() {
    let changed = false;
    for (const j of state.jobs) {
      if (j.status !== "failed") continue;
      resetJobForProcessing(j, { bumpAttempt: true });
      changed = true;
    }
    if (changed) recomputeSummary();
  }

  async function runQueue({ mode } = { mode: "all" }) {
    if (state.running) return;

    // Final hard-block check for Free
    const limitRes = validateLimits(state.jobs.map((j) => j.file), { totalBytes: state.totalBytes });
    if (!limitRes.ok) {
      setStatus(statusEl, limitError ? limitError.textContent : "Limit exceeded", { color: "#e74c3c" });
      expandProPanel();
      return;
    }

    // Pro soft cap warning (non-blocking)
    if (state.isPro && (state.jobs.length > SOFT_MAX_FILES || state.totalBytes > SOFT_MAX_BYTES)) {
      const key = "midieasy_csv_softcap_confirmed";
      if (!sessionStorage.getItem(key)) {
        const ok = confirm(`Large batch detected (${state.jobs.length} files / ${bytesToHuman(state.totalBytes)}). UI may stutter. Continue?`);
        if (!ok) return;
        sessionStorage.setItem(key, "1");
      }
    }

    if (mode === "all") prepareFailedJobsForConvert();

    const pending = state.jobs.filter((j) => j.status === "waiting");
    if (!pending.length) {
      if (mode === "all") {
        setStatus(statusEl, "All files are already converted.", { color: "#666" });
      }
      return;
    }

    state.running = true;

    applyProToUi();
    updateTopUi();
    renderList();
    setStatus(statusEl, state.isPro ? "Processing (Pro)…" : "Processing (Free)…", { color: "#666" });

    let inflight = 0;
    let cursor = 0;

    const launchNext = async () => {
      if (cursor >= pending.length) return;
      const job = pending[cursor++];
      inflight += 1;
      try {
        await processJob(job);
      } finally {
        inflight -= 1;
        await yieldToMainThread();
        await maybeLaunch();
      }
    };

    const maybeLaunch = async () => {
      while (inflight < state.maxConcurrency && cursor < pending.length) {
        void launchNext();
        await yieldToMainThread();
      }
    };

    await maybeLaunch();
    while (inflight > 0) {
      await new Promise((r) => setTimeout(r, 50));
    }

    state.running = false;
    applyProToUi();
    updateTopUi();

    if (state.success > 0) {
      setStatus(statusEl, `Done. ${state.success} succeeded${state.failed ? `, ${state.failed} failed` : ""}.`, { color: "#27ae60" });
      try {
        document.dispatchEvent(new CustomEvent("midieasy:conversion-complete", { detail: { successCount: state.success } }));
      } catch {
        // no-op
      }
    } else {
      setStatus(statusEl, `All failed (${state.failed}).`, { color: "#e74c3c" });
    }
  }

  function retryJob(jobId) {
    const job = state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    resetJobForProcessing(job, { bumpAttempt: true });
    updateTopUi();
    renderList();
    void runQueue({ mode: "pending" });
  }

  function retryAllFailed() {
    if (!state.isPro) {
      expandProPanel();
      return;
    }
    const failed = state.jobs.filter((j) => j.status === "failed");
    if (!failed.length) return;
    for (const j of failed) {
      resetJobForProcessing(j, { bumpAttempt: true });
    }
    updateTopUi();
    renderList();
    void runQueue({ mode: "pending" });
  }

  async function downloadZip() {
    if (state.running) return;
    if (state.success === 0) return;

    const zip = new JSZip();
    const used = new Set();
    for (const job of state.jobs) {
      if (job.status !== "done" || !job.csvBlob) continue;
      const name = uniqueCsvName(basenameNoExt(job.fileName), used);
      zip.file(name, job.csvBlob);
    }

    const report = buildReport({ jobs: state.jobs, isPro: state.isPro, globalMeta: { concurrency: state.maxConcurrency } });
    if (report) {
      zip.file("report.json", JSON.stringify(report, null, 2));
    }

    setStatus(statusEl, "Generating ZIP…", { color: "#666" });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, "midi-to-csv.zip");
    pushDataLayerEvent("zip_download_success", { trigger_source: "zip_download" });
    setStatus(statusEl, "ZIP downloaded.", { color: "#27ae60" });
  }

  function downloadReport() {
    if (!state.isPro) {
      expandProPanel();
      return;
    }
    const report = buildReport({ jobs: state.jobs, isPro: true, globalMeta: { concurrency: state.maxConcurrency } });
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    downloadBlob(blob, "report.json");
  }

  function clearResults() {
    if (state.running) return;
    hideZipProHint();
    state.jobs = [];
    state.totalBytes = 0;
    recomputeSummary();
    if (fileInput) fileInput.value = "";
    renderList();
    applyProToUi();
    updateTopUi();
    setStatus(statusEl, "", {});
  }

  function onFilesSelected(files) {
    if (state.running) {
      setStatus(statusEl, "Processing in progress. Please wait for completion.", { color: "#e67e22" });
      if (fileInput) fileInput.value = "";
      return;
    }

    const incomingMidiFiles = Array.from(files || []).filter((f) => isMidiFile(f));
    if (!incomingMidiFiles.length) {
      setStatus(statusEl, "Please select valid MIDI files (.mid/.midi).", { color: "#e74c3c" });
      if (fileInput) fileInput.value = "";
      return;
    }

    const mode = getSelectionMode();
    const seedKeys = mode === "append" ? new Set(state.jobs.map((j) => getFileIdentityKey(j.file))) : new Set();
    const uniqueFiles = [];
    let duplicateCount = 0;

    for (const file of incomingMidiFiles) {
      const key = getFileIdentityKey(file);
      if (seedKeys.has(key)) {
        duplicateCount += 1;
        continue;
      }
      seedKeys.add(key);
      uniqueFiles.push(file);
    }

    if (!uniqueFiles.length) {
      setStatus(statusEl, "All selected files are already in the list.", { color: "#e67e22" });
      if (fileInput) fileInput.value = "";
      return;
    }

    const targetFiles = mode === "append" ? state.jobs.map((j) => j.file).concat(uniqueFiles) : uniqueFiles;
    const targetBytes = targetFiles.reduce((sum, f) => sum + ((f && f.size) || 0), 0);
    const limitRes = validateLimits(targetFiles, { totalBytes: targetBytes });
    if (!limitRes.ok) {
      setStatus(statusEl, limitError ? limitError.textContent : "Limit exceeded", { color: "#e74c3c" });
      if (!state.isPro) expandProPanel();
      if (fileInput) fileInput.value = "";
      return;
    }

    if (mode === "append") appendJobs(uniqueFiles);
    else setJobsFromFiles(uniqueFiles);

    applyProToUi();
    renderList();
    updateTopUi();
    const action = mode === "append"
      ? `Added ${uniqueFiles.length} file(s) to current batch.`
      : `Started a new batch with ${uniqueFiles.length} file(s).`;
    const dup = duplicateCount > 0 ? ` Skipped ${duplicateCount} duplicate file(s).` : "";
    setStatus(statusEl, `${action}${dup}`, { color: "#666" });

    if (fileInput) fileInput.value = "";
  }

  // Wire events
  fileInput.addEventListener("change", () => onFilesSelected(fileInput.files));

  convertBtn.addEventListener("click", async () => {
    await runQueue({ mode: "all" });
  });

  zipBtn.addEventListener("click", async () => {
    pushDataLayerEvent("zip_download_click", { trigger_source: "zip_download" });
    maybeShowZipProHint();
    await downloadZip();
  });

  if (zipProBuyBtn) {
    zipProBuyBtn.addEventListener("click", (e) => {
      const href = zipProBuyBtn.getAttribute("href") || "";
      navigateWithTrackedEvent(e, {
        eventName: "zip_hint_pro_click",
        href,
        extraParams: { cta: "buy_pro", trigger_source: "zip_download" },
      });
    });
  }

  if (zipProFeaturesBtn) {
    zipProFeaturesBtn.addEventListener("click", (e) => {
      const href = zipProFeaturesBtn.getAttribute("href") || "/pro/";
      navigateWithTrackedEvent(e, {
        eventName: "zip_hint_pro_click",
        href,
        extraParams: { cta: "see_pro", trigger_source: "zip_download" },
      });
    });
  }

  if (zipProCloseBtn) {
    zipProCloseBtn.addEventListener("click", () => {
      hideZipProHint();
      pushDataLayerEvent("zip_hint_dismiss", { trigger_source: "zip_download" });
    });
  }

  if (reportBtn) reportBtn.addEventListener("click", downloadReport);
  if (retryAllBtn) retryAllBtn.addEventListener("click", retryAllFailed);
  if (clearBtn) clearBtn.addEventListener("click", clearResults);

  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("dragover");
  });
  dropArea.addEventListener("dragleave", () => dropArea.classList.remove("dragover"));
  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.classList.remove("dragover");
    const files = e.dataTransfer ? e.dataTransfer.files : null;
    onFilesSelected(files);
  });
  dropArea.addEventListener("click", () => fileInput.click());
  dropArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  document.addEventListener("midieasy:pro-changed", () => {
    applyProToUi();
    updateTopUi();
    renderList();
    if (state.isPro) hideZipProHint();
  });

  // Initial render
  applyProToUi();
  renderList();
  updateTopUi();
  setStatus(statusEl, "Ready. Files are processed locally in your browser.", { color: "#666" });
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    wireMidiToCsvPage();
  } catch (e) {
    console.error(e);
  }
});
