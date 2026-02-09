import { parseMidi } from "midi-file";

function isSmpteDivision(header) {
  const ppq = header && typeof header.ticksPerBeat === "number" ? header.ticksPerBeat : null;
  return !ppq || ppq <= 0;
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object") return null;

  // Note events
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

  // Meta events
  if (raw.type === "meta") {
    if (raw.subtype === "setTempo") {
      return { kind: "tempo", microsecondsPerBeat: raw.microsecondsPerBeat ?? raw.tempo ?? null };
    }
    if (raw.subtype === "timeSignature") {
      return {
        kind: "timeSig",
        numerator: raw.numerator ?? null,
        denominator: raw.denominator ?? null,
        metronome: raw.metronome ?? null,
        thirtyseconds: raw.thirtyseconds ?? null,
      };
    }
    if (raw.subtype === "trackName") {
      return { kind: "trackName", text: raw.text ?? "" };
    }
  }

  // Some variants use top-level types for meta.
  if (raw.type === "setTempo") {
    return { kind: "tempo", microsecondsPerBeat: raw.microsecondsPerBeat ?? raw.tempo ?? null };
  }
  if (raw.type === "timeSignature") {
    return {
      kind: "timeSig",
      numerator: raw.numerator ?? null,
      denominator: raw.denominator ?? null,
      metronome: raw.metronome ?? null,
      thirtyseconds: raw.thirtyseconds ?? null,
    };
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
      const prevSecPerTick = prev.microsecondsPerBeat / (ppq * 1_000_000);
      cumSec += (curr.tick - prev.tick) * prevSecPerTick;
    }
    segments.push({
      tick: curr.tick,
      microsecondsPerBeat: curr.microsecondsPerBeat,
      cumSecondsAtTick: cumSec,
      secondsPerTick: curr.microsecondsPerBeat / (ppq * 1_000_000),
    });
  }

  function tickToSeconds(tick) {
    const t = Number(tick);
    if (!Number.isFinite(t) || t < 0) return 0;
    // Find rightmost segment with seg.tick <= t (binary search)
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
    return seg.cumSecondsAtTick + (t - seg.tick) * seg.secondsPerTick;
  }

  return {
    segments,
    tickToSeconds,
    tempoEventsCount: cleaned.length,
    hasTempoChanges: cleaned.length > 1,
  };
}

export function parseMidiInspectorData(midiBytes, { includeNoteEvents = false } = {}) {
  const parsed = parseMidi(midiBytes);
  const header = parsed && parsed.header ? parsed.header : null;
  const tracks = Array.isArray(parsed && parsed.tracks) ? parsed.tracks : [];

  if (!header) {
    const err = new Error("Invalid MIDI header");
    err.code = "INVALID_MIDI";
    throw err;
  }

  if (isSmpteDivision(header)) {
    const err = new Error("Unsupported time division (SMPTE)");
    err.code = "UNSUPPORTED_TIME_DIVISION";
    throw err;
  }

  const ppq = header.ticksPerBeat;
  const tracksCount = tracks.length;

  const eventsAll = [];
  const eventsForUi = [];
  const trackNameByIndex = new Array(tracksCount).fill("");
  const trackEndTickByIndex = new Array(tracksCount).fill(0);

  let unknownEventCount = 0;

  // Flatten: compute abs ticks per track + normalize.
  for (let trackIndex = 0; trackIndex < tracksCount; trackIndex++) {
    const rawEvents = tracks[trackIndex] || [];
    let absTick = 0;
    let firstTrackName = "";

    for (let eventOrder = 0; eventOrder < rawEvents.length; eventOrder++) {
      const raw = rawEvents[eventOrder];
      absTick += Number(raw && raw.deltaTime ? raw.deltaTime : 0);
      const normalized = normalizeEvent(raw);
      if (!normalized) {
        // Ignore standard end-of-track meta noise where possible; otherwise count.
        if (!(raw && raw.type === "meta" && raw.subtype === "endOfTrack")) unknownEventCount += 1;
        continue;
      }

      if (normalized.kind === "trackName") {
        if (!firstTrackName) firstTrackName = String(normalized.text || "");
        continue;
      }

      const node = {
        tick: absTick,
        trackIndex,
        eventOrder,
        normalized,
      };
      eventsAll.push(node);

      const isNote = normalized.kind === "noteOn" || normalized.kind === "noteOff";
      if (includeNoteEvents || !isNote) {
        eventsForUi.push(node);
      }
    }

    trackNameByIndex[trackIndex] = firstTrackName;
    trackEndTickByIndex[trackIndex] = absTick;
  }

  eventsAll.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.trackIndex !== b.trackIndex) return a.trackIndex - b.trackIndex;
    return a.eventOrder - b.eventOrder;
  });

  eventsForUi.sort((a, b) => {
    if (a.tick !== b.tick) return a.tick - b.tick;
    if (a.trackIndex !== b.trackIndex) return a.trackIndex - b.trackIndex;
    return a.eventOrder - b.eventOrder;
  });

  // Derive notes + quality metrics
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

  for (const ev of eventsAll) {
    const { tick, trackIndex, normalized } = ev;

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

  // Sort notes: start_ticks asc
  notes.sort((a, b) => a.start_ticks - b.start_ticks);

  const tempoIndex = buildTempoIndex({ ppq, tempoEvents });
  for (const n of notes) {
    const s0 = tempoIndex.tickToSeconds(n.start_ticks);
    const s1 = tempoIndex.tickToSeconds(n.end_ticks);
    n.start_seconds = s0;
    n.duration_seconds = Math.max(0, s1 - s0);
  }

  const durationTicks = trackEndTickByIndex.reduce((m, t) => Math.max(m, t || 0), 0);

  const tracksOut = [];
  for (let i = 0; i < tracksCount; i++) {
    tracksOut.push({
      trackIndex: i,
      trackName: trackNameByIndex[i] || "",
      endTick: trackEndTickByIndex[i] || 0,
    });
  }

  const eventsOut = eventsForUi.map((n) => {
    const e = n.normalized;
    const kind = e.kind;
    const out = {
      tick: n.tick,
      trackIndex: n.trackIndex,
      eventOrder: n.eventOrder,
      kind,
      channel: typeof e.channel === "number" ? e.channel : null,
      data: null,
    };
    if (kind === "tempo") out.data = { microsecondsPerBeat: e.microsecondsPerBeat };
    else if (kind === "timeSig") out.data = { numerator: e.numerator, denominator: e.denominator, metronome: e.metronome, thirtyseconds: e.thirtyseconds };
    else if (kind === "program") out.data = { program: e.program };
    else if (kind === "cc") out.data = { controller: e.controller, value: e.value };
    else if (kind === "noteOn") out.data = { pitch: e.pitch, velocity: e.velocity };
    else if (kind === "noteOff") out.data = { pitch: e.pitch, velocity: e.velocity, velocity0: !!e.velocity0 };
    return out;
  });

  return {
    fileMeta: {
      divisionType: "PPQ",
      ppq,
      tracksCount,
      durationTicks,
      warnings: [],
    },
    tracks: tracksOut,
    events: eventsOut,
    notes,
    quality: {
      overlapCount,
      danglingCount,
      orphanOffCount,
      unknownEventCount,
      hasSustainPedalEvents,
      sampleErrors,
    },
    tempo: {
      tempoMapReady: true,
      tempoEventsCount: tempoIndex.tempoEventsCount,
      hasTempoChanges: tempoIndex.hasTempoChanges,
      segments: tempoIndex.segments,
    },
  };
}

export function tickToSecondsFromSegments(segments, tick) {
  const t = Number(tick);
  if (!Array.isArray(segments) || !Number.isFinite(t) || t < 0) return 0;
  if (!segments.length) return 0;
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
  return seg.cumSecondsAtTick + (t - seg.tick) * seg.secondsPerTick;
}

