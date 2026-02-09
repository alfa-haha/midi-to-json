function pitchToName(pitch) {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const p = Number(pitch);
  if (!Number.isFinite(p)) return "";
  const nn = ((p % 12) + 12) % 12;
  const octave = Math.floor(p / 12) - 1;
  return `${names[nn]}${octave}`;
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[,"\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function formatSeconds(sec) {
  if (!Number.isFinite(sec)) return "";
  const s = sec.toFixed(6);
  return s.replace(/\.?0+$/, "");
}

export const MIDI_INSPECTOR_EXPORT_SCHEMA_VERSION = "midieasy.midi-inspector.export.v0.1";

export function buildInspectorReport({ data, isPro, toolVersion, fileName, fileBytes }) {
  const nowIso = new Date().toISOString();
  const fileMeta = data && data.fileMeta ? data.fileMeta : {};
  const quality = data && data.quality ? data.quality : {};
  const tempo = data && data.tempo ? data.tempo : {};

  const base = {
    schemaVersion: MIDI_INSPECTOR_EXPORT_SCHEMA_VERSION,
    tool: "midi-inspector",
    toolVersion: String(toolVersion || "0.1.0"),
    generatedAt: nowIso,
    source: {
      fileName: fileName ? String(fileName) : null,
      fileBytes: Number.isFinite(fileBytes) ? fileBytes : null,
    },
    fileMeta: {
      divisionType: fileMeta.divisionType ?? "PPQ",
      ppq: fileMeta.ppq ?? null,
      tracksCount: fileMeta.tracksCount ?? 0,
      durationTicks: fileMeta.durationTicks ?? 0,
    },
    tempo: {
      tempoMapReady: !!tempo.tempoMapReady,
      tempoEventsCount: tempo.tempoEventsCount ?? 0,
      hasTempoChanges: !!tempo.hasTempoChanges,
    },
    quality: {
      overlapCount: quality.overlapCount ?? 0,
      danglingCount: quality.danglingCount ?? 0,
      orphanOffCount: quality.orphanOffCount ?? 0,
      unknownEventCount: quality.unknownEventCount ?? 0,
      hasSustainPedalEvents: !!quality.hasSustainPedalEvents,
      sampleErrors: Array.isArray(quality.sampleErrors) ? quality.sampleErrors : [],
    },
  };

  if (!isPro) return base;

  const tracks = Array.isArray(data && data.tracks) ? data.tracks : [];
  const notes = Array.isArray(data && data.notes) ? data.notes : [];
  const events = Array.isArray(data && data.events) ? data.events : [];

  // Lightweight aggregates for Pro.
  const notesByTrack = new Array(tracks.length).fill(0);
  const channelsUsed = new Set();
  const programsUsed = new Set();
  for (const n of notes) {
    if (Number.isFinite(n.track_index) && n.track_index >= 0 && n.track_index < notesByTrack.length) {
      notesByTrack[n.track_index] += 1;
    }
    if (Number.isFinite(n.channel)) channelsUsed.add(n.channel);
    if (Number.isFinite(n.program)) programsUsed.add(n.program);
  }

  const timeSigEventsCount = events.reduce((c, e) => c + (e && e.kind === "timeSig" ? 1 : 0), 0);
  const programEventsCount = events.reduce((c, e) => c + (e && e.kind === "program" ? 1 : 0), 0);
  const ccEventsCount = events.reduce((c, e) => c + (e && e.kind === "cc" ? 1 : 0), 0);

  return {
    ...base,
    isPro: true,
    stats: {
      notesCount: notes.length,
      eventsCount: events.length,
      timeSigEventsCount,
      programEventsCount,
      ccEventsCount,
      channelsUsed: Array.from(channelsUsed).sort((a, b) => a - b),
      programsUsed: Array.from(programsUsed).sort((a, b) => a - b),
    },
    tracks: tracks.map((t, idx) => ({
      trackIndex: t.trackIndex,
      trackName: t.trackName || "",
      endTick: t.endTick ?? 0,
      notesCount: notesByTrack[idx] ?? 0,
    })),
  };
}

export function notesToInspectorCsv({ notes, includeSeconds }) {
  const includeSec = !!includeSeconds;
  const header = [
    "track",
    "track_name",
    "channel",
    "program",
    "pitch",
    "note_name",
    "start_ticks",
    "duration_ticks",
    ...(includeSec ? ["start_seconds", "duration_seconds"] : []),
    "velocity",
    "flags",
  ];
  const lines = [header.join(",")];

  for (const n of Array.isArray(notes) ? notes : []) {
    const flags = n && n.flags ? n.flags : {};
    const flagParts = [];
    if (flags.overlap) flagParts.push("overlap");
    if (flags.dangling) flagParts.push("dangling");
    if (flags.velocity0_noteoff) flagParts.push("velocity0_noteoff");
    const flagsStr = flagParts.join("|");

    const row = [
      csvEscape((Number(n.track_index) + 1).toString()),
      csvEscape(String(n.track_name ?? "")),
      csvEscape(String(n.channel ?? "")),
      csvEscape(String(n.program ?? "")),
      csvEscape(String(n.pitch ?? "")),
      csvEscape(pitchToName(n.pitch)),
      csvEscape(String(n.start_ticks ?? "")),
      csvEscape(String(n.duration_ticks ?? "")),
      ...(includeSec ? [csvEscape(formatSeconds(n.start_seconds)), csvEscape(formatSeconds(n.duration_seconds))] : []),
      csvEscape(String(n.velocity ?? "")),
      csvEscape(flagsStr),
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n") + "\n";
}

export function filterNotes(notes, filters) {
  const f = filters || {};
  const trackSet = f.trackSet instanceof Set ? f.trackSet : null;
  const channelSet = f.channelSet instanceof Set ? f.channelSet : null;
  const pitchMin = Number.isFinite(f.pitchMin) ? f.pitchMin : null;
  const pitchMax = Number.isFinite(f.pitchMax) ? f.pitchMax : null;
  const tickStart = Number.isFinite(f.tickStart) ? f.tickStart : null;
  const tickEnd = Number.isFinite(f.tickEnd) ? f.tickEnd : null;

  const flags = f.flags || null;

  const out = [];
  for (const n of Array.isArray(notes) ? notes : []) {
    if (trackSet && !trackSet.has(n.track_index)) continue;
    if (channelSet && !channelSet.has(n.channel)) continue;
    if (pitchMin !== null && n.pitch < pitchMin) continue;
    if (pitchMax !== null && n.pitch > pitchMax) continue;
    if (tickStart !== null && n.start_ticks < tickStart) continue;
    if (tickEnd !== null && n.start_ticks > tickEnd) continue;

    if (flags && typeof flags === "object") {
      const nf = n.flags || {};
      if (flags.overlap && !nf.overlap) continue;
      if (flags.dangling && !nf.dangling) continue;
      if (flags.velocity0_noteoff && !nf.velocity0_noteoff) continue;
    }

    out.push(n);
  }
  return out;
}

export function filterEvents(events, filters) {
  const f = filters || {};
  const trackSet = f.trackSet instanceof Set ? f.trackSet : null;
  const channelSet = f.channelSet instanceof Set ? f.channelSet : null;
  const tickStart = Number.isFinite(f.tickStart) ? f.tickStart : null;
  const tickEnd = Number.isFinite(f.tickEnd) ? f.tickEnd : null;

  const typeSet = f.typeSet instanceof Set ? f.typeSet : null;
  const cc64Only = !!f.cc64Only;

  const out = [];
  for (const e of Array.isArray(events) ? events : []) {
    if (trackSet && !trackSet.has(e.trackIndex)) continue;
    if (channelSet && e.channel !== null && !channelSet.has(e.channel)) continue;
    if (tickStart !== null && e.tick < tickStart) continue;
    if (tickEnd !== null && e.tick > tickEnd) continue;
    if (typeSet && !typeSet.has(e.kind)) continue;
    if (cc64Only && e.kind === "cc") {
      const controller = e.data && typeof e.data.controller === "number" ? e.data.controller : null;
      if (controller !== 64) continue;
    }
    out.push(e);
  }
  return out;
}

export function buildEventsJson({ events }) {
  const out = [];
  for (const e of Array.isArray(events) ? events : []) {
    // v0.1: keep the payload evolvable under `data`.
    out.push({
      tick: e.tick,
      kind: e.kind,
      trackIndex: e.trackIndex,
      channel: e.channel === null ? undefined : e.channel,
      data: e.data || {},
    });
  }
  return out;
}
