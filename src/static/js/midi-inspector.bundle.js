(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/midi-file/lib/midi-parser.js
  var require_midi_parser = __commonJS({
    "node_modules/midi-file/lib/midi-parser.js"(exports, module) {
      function parseMidi2(data) {
        var p = new Parser(data);
        var headerChunk = p.readChunk();
        if (headerChunk.id != "MThd")
          throw "Bad MIDI file.  Expected 'MHdr', got: '" + headerChunk.id + "'";
        var header = parseHeader(headerChunk.data);
        var tracks = [];
        for (var i = 0; !p.eof() && i < header.numTracks; i++) {
          var trackChunk = p.readChunk();
          if (trackChunk.id != "MTrk")
            throw "Bad MIDI file.  Expected 'MTrk', got: '" + trackChunk.id + "'";
          var track = parseTrack(trackChunk.data);
          tracks.push(track);
        }
        return {
          header,
          tracks
        };
      }
      function parseHeader(data) {
        var p = new Parser(data);
        var format = p.readUInt16();
        var numTracks = p.readUInt16();
        var result = {
          format,
          numTracks
        };
        var timeDivision = p.readUInt16();
        if (timeDivision & 32768) {
          result.framesPerSecond = 256 - (timeDivision >> 8);
          result.ticksPerFrame = timeDivision & 255;
        } else {
          result.ticksPerBeat = timeDivision;
        }
        return result;
      }
      function parseTrack(data) {
        var p = new Parser(data);
        var events = [];
        while (!p.eof()) {
          var event = readEvent();
          events.push(event);
        }
        return events;
        var lastEventTypeByte = null;
        function readEvent() {
          var event2 = {};
          event2.deltaTime = p.readVarInt();
          var eventTypeByte = p.readUInt8();
          if ((eventTypeByte & 240) === 240) {
            if (eventTypeByte === 255) {
              event2.meta = true;
              var metatypeByte = p.readUInt8();
              var length = p.readVarInt();
              switch (metatypeByte) {
                case 0:
                  event2.type = "sequenceNumber";
                  if (length !== 2) throw "Expected length for sequenceNumber event is 2, got " + length;
                  event2.number = p.readUInt16();
                  return event2;
                case 1:
                  event2.type = "text";
                  event2.text = p.readString(length);
                  return event2;
                case 2:
                  event2.type = "copyrightNotice";
                  event2.text = p.readString(length);
                  return event2;
                case 3:
                  event2.type = "trackName";
                  event2.text = p.readString(length);
                  return event2;
                case 4:
                  event2.type = "instrumentName";
                  event2.text = p.readString(length);
                  return event2;
                case 5:
                  event2.type = "lyrics";
                  event2.text = p.readString(length);
                  return event2;
                case 6:
                  event2.type = "marker";
                  event2.text = p.readString(length);
                  return event2;
                case 7:
                  event2.type = "cuePoint";
                  event2.text = p.readString(length);
                  return event2;
                case 32:
                  event2.type = "channelPrefix";
                  if (length != 1) throw "Expected length for channelPrefix event is 1, got " + length;
                  event2.channel = p.readUInt8();
                  return event2;
                case 33:
                  event2.type = "portPrefix";
                  if (length != 1) throw "Expected length for portPrefix event is 1, got " + length;
                  event2.port = p.readUInt8();
                  return event2;
                case 47:
                  event2.type = "endOfTrack";
                  if (length != 0) throw "Expected length for endOfTrack event is 0, got " + length;
                  return event2;
                case 81:
                  event2.type = "setTempo";
                  if (length != 3) throw "Expected length for setTempo event is 3, got " + length;
                  event2.microsecondsPerBeat = p.readUInt24();
                  return event2;
                case 84:
                  event2.type = "smpteOffset";
                  if (length != 5) throw "Expected length for smpteOffset event is 5, got " + length;
                  var hourByte = p.readUInt8();
                  var FRAME_RATES = { 0: 24, 32: 25, 64: 29, 96: 30 };
                  event2.frameRate = FRAME_RATES[hourByte & 96];
                  event2.hour = hourByte & 31;
                  event2.min = p.readUInt8();
                  event2.sec = p.readUInt8();
                  event2.frame = p.readUInt8();
                  event2.subFrame = p.readUInt8();
                  return event2;
                case 88:
                  event2.type = "timeSignature";
                  if (length != 2 && length != 4) throw "Expected length for timeSignature event is 4 or 2, got " + length;
                  event2.numerator = p.readUInt8();
                  event2.denominator = 1 << p.readUInt8();
                  if (length === 4) {
                    event2.metronome = p.readUInt8();
                    event2.thirtyseconds = p.readUInt8();
                  } else {
                    event2.metronome = 36;
                    event2.thirtyseconds = 8;
                  }
                  return event2;
                case 89:
                  event2.type = "keySignature";
                  if (length != 2) throw "Expected length for keySignature event is 2, got " + length;
                  event2.key = p.readInt8();
                  event2.scale = p.readUInt8();
                  return event2;
                case 127:
                  event2.type = "sequencerSpecific";
                  event2.data = p.readBytes(length);
                  return event2;
                default:
                  event2.type = "unknownMeta";
                  event2.data = p.readBytes(length);
                  event2.metatypeByte = metatypeByte;
                  return event2;
              }
            } else if (eventTypeByte == 240) {
              event2.type = "sysEx";
              var length = p.readVarInt();
              event2.data = p.readBytes(length);
              return event2;
            } else if (eventTypeByte == 247) {
              event2.type = "endSysEx";
              var length = p.readVarInt();
              event2.data = p.readBytes(length);
              return event2;
            } else {
              throw "Unrecognised MIDI event type byte: " + eventTypeByte;
            }
          } else {
            var param1;
            if ((eventTypeByte & 128) === 0) {
              if (lastEventTypeByte === null)
                throw "Running status byte encountered before status byte";
              param1 = eventTypeByte;
              eventTypeByte = lastEventTypeByte;
              event2.running = true;
            } else {
              param1 = p.readUInt8();
              lastEventTypeByte = eventTypeByte;
            }
            var eventType = eventTypeByte >> 4;
            event2.channel = eventTypeByte & 15;
            switch (eventType) {
              case 8:
                event2.type = "noteOff";
                event2.noteNumber = param1;
                event2.velocity = p.readUInt8();
                return event2;
              case 9:
                var velocity = p.readUInt8();
                event2.type = velocity === 0 ? "noteOff" : "noteOn";
                event2.noteNumber = param1;
                event2.velocity = velocity;
                if (velocity === 0) event2.byte9 = true;
                return event2;
              case 10:
                event2.type = "noteAftertouch";
                event2.noteNumber = param1;
                event2.amount = p.readUInt8();
                return event2;
              case 11:
                event2.type = "controller";
                event2.controllerType = param1;
                event2.value = p.readUInt8();
                return event2;
              case 12:
                event2.type = "programChange";
                event2.programNumber = param1;
                return event2;
              case 13:
                event2.type = "channelAftertouch";
                event2.amount = param1;
                return event2;
              case 14:
                event2.type = "pitchBend";
                event2.value = param1 + (p.readUInt8() << 7) - 8192;
                return event2;
              default:
                throw "Unrecognised MIDI event type: " + eventType;
            }
          }
        }
      }
      function Parser(data) {
        this.buffer = data;
        this.bufferLen = this.buffer.length;
        this.pos = 0;
      }
      Parser.prototype.eof = function() {
        return this.pos >= this.bufferLen;
      };
      Parser.prototype.readUInt8 = function() {
        var result = this.buffer[this.pos];
        this.pos += 1;
        return result;
      };
      Parser.prototype.readInt8 = function() {
        var u = this.readUInt8();
        if (u & 128)
          return u - 256;
        else
          return u;
      };
      Parser.prototype.readUInt16 = function() {
        var b0 = this.readUInt8(), b1 = this.readUInt8();
        return (b0 << 8) + b1;
      };
      Parser.prototype.readInt16 = function() {
        var u = this.readUInt16();
        if (u & 32768)
          return u - 65536;
        else
          return u;
      };
      Parser.prototype.readUInt24 = function() {
        var b0 = this.readUInt8(), b1 = this.readUInt8(), b2 = this.readUInt8();
        return (b0 << 16) + (b1 << 8) + b2;
      };
      Parser.prototype.readInt24 = function() {
        var u = this.readUInt24();
        if (u & 8388608)
          return u - 16777216;
        else
          return u;
      };
      Parser.prototype.readUInt32 = function() {
        var b0 = this.readUInt8(), b1 = this.readUInt8(), b2 = this.readUInt8(), b3 = this.readUInt8();
        return (b0 << 24) + (b1 << 16) + (b2 << 8) + b3;
      };
      Parser.prototype.readBytes = function(len) {
        var bytes = this.buffer.slice(this.pos, this.pos + len);
        this.pos += len;
        return bytes;
      };
      Parser.prototype.readString = function(len) {
        var bytes = this.readBytes(len);
        return String.fromCharCode.apply(null, bytes);
      };
      Parser.prototype.readVarInt = function() {
        var result = 0;
        while (!this.eof()) {
          var b = this.readUInt8();
          if (b & 128) {
            result += b & 127;
            result <<= 7;
          } else {
            return result + b;
          }
        }
        return result;
      };
      Parser.prototype.readChunk = function() {
        var id = this.readString(4);
        var length = this.readUInt32();
        var data = this.readBytes(length);
        return {
          id,
          length,
          data
        };
      };
      module.exports = parseMidi2;
    }
  });

  // node_modules/midi-file/lib/midi-writer.js
  var require_midi_writer = __commonJS({
    "node_modules/midi-file/lib/midi-writer.js"(exports, module) {
      function writeMidi(data, opts) {
        if (typeof data !== "object")
          throw "Invalid MIDI data";
        opts = opts || {};
        var header = data.header || {};
        var tracks = data.tracks || [];
        var i, len = tracks.length;
        var w = new Writer();
        writeHeader(w, header, len);
        for (i = 0; i < len; i++) {
          writeTrack(w, tracks[i], opts);
        }
        return w.buffer;
      }
      function writeHeader(w, header, numTracks) {
        var format = header.format == null ? 1 : header.format;
        var timeDivision = 128;
        if (header.timeDivision) {
          timeDivision = header.timeDivision;
        } else if (header.ticksPerFrame && header.framesPerSecond) {
          timeDivision = -(header.framesPerSecond & 255) << 8 | header.ticksPerFrame & 255;
        } else if (header.ticksPerBeat) {
          timeDivision = header.ticksPerBeat & 32767;
        }
        var h = new Writer();
        h.writeUInt16(format);
        h.writeUInt16(numTracks);
        h.writeUInt16(timeDivision);
        w.writeChunk("MThd", h.buffer);
      }
      function writeTrack(w, track, opts) {
        var t = new Writer();
        var i, len = track.length;
        var eventTypeByte = null;
        for (i = 0; i < len; i++) {
          if (opts.running === false || !opts.running && !track[i].running) eventTypeByte = null;
          eventTypeByte = writeEvent(t, track[i], eventTypeByte, opts.useByte9ForNoteOff);
        }
        w.writeChunk("MTrk", t.buffer);
      }
      function writeEvent(w, event, lastEventTypeByte, useByte9ForNoteOff) {
        var type = event.type;
        var deltaTime = event.deltaTime;
        var text = event.text || "";
        var data = event.data || [];
        var eventTypeByte = null;
        w.writeVarInt(deltaTime);
        switch (type) {
          // meta events
          case "sequenceNumber":
            w.writeUInt8(255);
            w.writeUInt8(0);
            w.writeVarInt(2);
            w.writeUInt16(event.number);
            break;
          case "text":
            w.writeUInt8(255);
            w.writeUInt8(1);
            w.writeVarInt(text.length);
            w.writeString(text);
            break;
          case "copyrightNotice":
            w.writeUInt8(255);
            w.writeUInt8(2);
            w.writeVarInt(text.length);
            w.writeString(text);
            break;
          case "trackName":
            w.writeUInt8(255);
            w.writeUInt8(3);
            w.writeVarInt(text.length);
            w.writeString(text);
            break;
          case "instrumentName":
            w.writeUInt8(255);
            w.writeUInt8(4);
            w.writeVarInt(text.length);
            w.writeString(text);
            break;
          case "lyrics":
            w.writeUInt8(255);
            w.writeUInt8(5);
            w.writeVarInt(text.length);
            w.writeString(text);
            break;
          case "marker":
            w.writeUInt8(255);
            w.writeUInt8(6);
            w.writeVarInt(text.length);
            w.writeString(text);
            break;
          case "cuePoint":
            w.writeUInt8(255);
            w.writeUInt8(7);
            w.writeVarInt(text.length);
            w.writeString(text);
            break;
          case "channelPrefix":
            w.writeUInt8(255);
            w.writeUInt8(32);
            w.writeVarInt(1);
            w.writeUInt8(event.channel);
            break;
          case "portPrefix":
            w.writeUInt8(255);
            w.writeUInt8(33);
            w.writeVarInt(1);
            w.writeUInt8(event.port);
            break;
          case "endOfTrack":
            w.writeUInt8(255);
            w.writeUInt8(47);
            w.writeVarInt(0);
            break;
          case "setTempo":
            w.writeUInt8(255);
            w.writeUInt8(81);
            w.writeVarInt(3);
            w.writeUInt24(event.microsecondsPerBeat);
            break;
          case "smpteOffset":
            w.writeUInt8(255);
            w.writeUInt8(84);
            w.writeVarInt(5);
            var FRAME_RATES = { 24: 0, 25: 32, 29: 64, 30: 96 };
            var hourByte = event.hour & 31 | FRAME_RATES[event.frameRate];
            w.writeUInt8(hourByte);
            w.writeUInt8(event.min);
            w.writeUInt8(event.sec);
            w.writeUInt8(event.frame);
            w.writeUInt8(event.subFrame);
            break;
          case "timeSignature":
            w.writeUInt8(255);
            w.writeUInt8(88);
            w.writeVarInt(4);
            w.writeUInt8(event.numerator);
            var denominator = Math.floor(Math.log(event.denominator) / Math.LN2) & 255;
            w.writeUInt8(denominator);
            w.writeUInt8(event.metronome);
            w.writeUInt8(event.thirtyseconds || 8);
            break;
          case "keySignature":
            w.writeUInt8(255);
            w.writeUInt8(89);
            w.writeVarInt(2);
            w.writeInt8(event.key);
            w.writeUInt8(event.scale);
            break;
          case "sequencerSpecific":
            w.writeUInt8(255);
            w.writeUInt8(127);
            w.writeVarInt(data.length);
            w.writeBytes(data);
            break;
          case "unknownMeta":
            if (event.metatypeByte != null) {
              w.writeUInt8(255);
              w.writeUInt8(event.metatypeByte);
              w.writeVarInt(data.length);
              w.writeBytes(data);
            }
            break;
          // system-exclusive
          case "sysEx":
            w.writeUInt8(240);
            w.writeVarInt(data.length);
            w.writeBytes(data);
            break;
          case "endSysEx":
            w.writeUInt8(247);
            w.writeVarInt(data.length);
            w.writeBytes(data);
            break;
          // channel events
          case "noteOff":
            var noteByte = useByte9ForNoteOff !== false && event.byte9 || useByte9ForNoteOff && event.velocity == 0 ? 144 : 128;
            eventTypeByte = noteByte | event.channel;
            if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
            w.writeUInt8(event.noteNumber);
            w.writeUInt8(event.velocity);
            break;
          case "noteOn":
            eventTypeByte = 144 | event.channel;
            if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
            w.writeUInt8(event.noteNumber);
            w.writeUInt8(event.velocity);
            break;
          case "noteAftertouch":
            eventTypeByte = 160 | event.channel;
            if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
            w.writeUInt8(event.noteNumber);
            w.writeUInt8(event.amount);
            break;
          case "controller":
            eventTypeByte = 176 | event.channel;
            if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
            w.writeUInt8(event.controllerType);
            w.writeUInt8(event.value);
            break;
          case "programChange":
            eventTypeByte = 192 | event.channel;
            if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
            w.writeUInt8(event.programNumber);
            break;
          case "channelAftertouch":
            eventTypeByte = 208 | event.channel;
            if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
            w.writeUInt8(event.amount);
            break;
          case "pitchBend":
            eventTypeByte = 224 | event.channel;
            if (eventTypeByte !== lastEventTypeByte) w.writeUInt8(eventTypeByte);
            var value14 = 8192 + event.value;
            var lsb14 = value14 & 127;
            var msb14 = value14 >> 7 & 127;
            w.writeUInt8(lsb14);
            w.writeUInt8(msb14);
            break;
          default:
            throw "Unrecognized event type: " + type;
        }
        return eventTypeByte;
      }
      function Writer() {
        this.buffer = [];
      }
      Writer.prototype.writeUInt8 = function(v) {
        this.buffer.push(v & 255);
      };
      Writer.prototype.writeInt8 = Writer.prototype.writeUInt8;
      Writer.prototype.writeUInt16 = function(v) {
        var b0 = v >> 8 & 255, b1 = v & 255;
        this.writeUInt8(b0);
        this.writeUInt8(b1);
      };
      Writer.prototype.writeInt16 = Writer.prototype.writeUInt16;
      Writer.prototype.writeUInt24 = function(v) {
        var b0 = v >> 16 & 255, b1 = v >> 8 & 255, b2 = v & 255;
        this.writeUInt8(b0);
        this.writeUInt8(b1);
        this.writeUInt8(b2);
      };
      Writer.prototype.writeInt24 = Writer.prototype.writeUInt24;
      Writer.prototype.writeUInt32 = function(v) {
        var b0 = v >> 24 & 255, b1 = v >> 16 & 255, b2 = v >> 8 & 255, b3 = v & 255;
        this.writeUInt8(b0);
        this.writeUInt8(b1);
        this.writeUInt8(b2);
        this.writeUInt8(b3);
      };
      Writer.prototype.writeInt32 = Writer.prototype.writeUInt32;
      Writer.prototype.writeBytes = function(arr) {
        this.buffer = this.buffer.concat(Array.prototype.slice.call(arr, 0));
      };
      Writer.prototype.writeString = function(str) {
        var i, len = str.length, arr = [];
        for (i = 0; i < len; i++) {
          arr.push(str.codePointAt(i));
        }
        this.writeBytes(arr);
      };
      Writer.prototype.writeVarInt = function(v) {
        if (v < 0) throw "Cannot write negative variable-length integer";
        if (v <= 127) {
          this.writeUInt8(v);
        } else {
          var i = v;
          var bytes = [];
          bytes.push(i & 127);
          i >>= 7;
          while (i) {
            var b = i & 127 | 128;
            bytes.push(b);
            i >>= 7;
          }
          this.writeBytes(bytes.reverse());
        }
      };
      Writer.prototype.writeChunk = function(id, data) {
        this.writeString(id);
        this.writeUInt32(data.length);
        this.writeBytes(data);
      };
      module.exports = writeMidi;
    }
  });

  // node_modules/midi-file/index.js
  var require_midi_file = __commonJS({
    "node_modules/midi-file/index.js"(exports) {
      exports.parseMidi = require_midi_parser();
      exports.writeMidi = require_midi_writer();
    }
  });

  // src/static/js/midi-core/parse.js
  var import_midi_file = __toESM(require_midi_file());
  function isSmpteDivision(header) {
    const ppq = header && typeof header.ticksPerBeat === "number" ? header.ticksPerBeat : null;
    return !ppq || ppq <= 0;
  }
  function normalizeEvent(raw) {
    if (!raw || typeof raw !== "object") return null;
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
    if (raw.type === "programChange") {
      return { kind: "program", channel: raw.channel, program: raw.programNumber ?? 0 };
    }
    if (raw.type === "controller") {
      return { kind: "cc", channel: raw.channel, controller: raw.controllerType ?? raw.controllerNumber ?? raw.controller ?? 0, value: raw.value ?? 0 };
    }
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
          thirtyseconds: raw.thirtyseconds ?? null
        };
      }
      if (raw.subtype === "trackName") {
        return { kind: "trackName", text: raw.text ?? "" };
      }
    }
    if (raw.type === "setTempo") {
      return { kind: "tempo", microsecondsPerBeat: raw.microsecondsPerBeat ?? raw.tempo ?? null };
    }
    if (raw.type === "timeSignature") {
      return {
        kind: "timeSig",
        numerator: raw.numerator ?? null,
        denominator: raw.denominator ?? null,
        metronome: raw.metronome ?? null,
        thirtyseconds: raw.thirtyseconds ?? null
      };
    }
    if (raw.type === "trackName") {
      return { kind: "trackName", text: raw.text ?? "" };
    }
    return null;
  }
  function buildTempoIndex({ ppq, tempoEvents }) {
    const DEFAULT_US_PER_BEAT = 5e5;
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
        const prevSecPerTick = prev.microsecondsPerBeat / (ppq * 1e6);
        cumSec += (curr.tick - prev.tick) * prevSecPerTick;
      }
      segments.push({
        tick: curr.tick,
        microsecondsPerBeat: curr.microsecondsPerBeat,
        cumSecondsAtTick: cumSec,
        secondsPerTick: curr.microsecondsPerBeat / (ppq * 1e6)
      });
    }
    function tickToSeconds(tick) {
      const t = Number(tick);
      if (!Number.isFinite(t) || t < 0) return 0;
      let lo = 0;
      let hi = segments.length - 1;
      let idx = 0;
      while (lo <= hi) {
        const mid = lo + hi >> 1;
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
      hasTempoChanges: cleaned.length > 1
    };
  }
  function parseMidiInspectorData(midiBytes, { includeNoteEvents = false } = {}) {
    const parsed = (0, import_midi_file.parseMidi)(midiBytes);
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
    for (let trackIndex = 0; trackIndex < tracksCount; trackIndex++) {
      const rawEvents = tracks[trackIndex] || [];
      let absTick = 0;
      let firstTrackName = "";
      for (let eventOrder = 0; eventOrder < rawEvents.length; eventOrder++) {
        const raw = rawEvents[eventOrder];
        absTick += Number(raw && raw.deltaTime ? raw.deltaTime : 0);
        const normalized = normalizeEvent(raw);
        if (!normalized) {
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
          normalized
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
    const programByChannel = new Array(16).fill(0);
    let hasSustainPedalEvents = false;
    const tempoEvents = [];
    const active = Array.from(
      { length: tracksCount },
      () => Array.from({ length: 16 }, () => Array.from({ length: 128 }, () => []))
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
          overlapAtStart: stack.length > 0
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
        const durationTicks2 = endTick - start.startTick;
        if (durationTicks2 < 0) {
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
          duration_ticks: durationTicks2,
          program: start.programAtStart,
          flags: {
            overlap: !!start.overlapAtStart,
            velocity0_noteoff: !!normalized.velocity0,
            dangling: false
          }
        });
        continue;
      }
    }
    for (let trackIndex = 0; trackIndex < tracksCount; trackIndex++) {
      const trackEndTick = trackEndTickByIndex[trackIndex] || 0;
      for (let ch = 0; ch < 16; ch++) {
        for (let pitch = 0; pitch < 128; pitch++) {
          const stack = active[trackIndex][ch][pitch];
          while (stack.length) {
            const start = stack.pop();
            danglingCount += 1;
            const endTick = trackEndTick;
            const durationTicks2 = endTick - start.startTick;
            if (durationTicks2 < 0) continue;
            notes.push({
              track_index: trackIndex,
              track_name: trackNameByIndex[trackIndex] || "",
              channel: ch,
              pitch,
              velocity: start.velocity,
              start_ticks: start.startTick,
              end_ticks: endTick,
              duration_ticks: durationTicks2,
              program: start.programAtStart,
              flags: {
                overlap: !!start.overlapAtStart,
                velocity0_noteoff: false,
                dangling: true,
                forced_end_tick: endTick
              }
            });
          }
        }
      }
    }
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
        endTick: trackEndTickByIndex[i] || 0
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
        data: null
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
        warnings: []
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
        sampleErrors
      },
      tempo: {
        tempoMapReady: true,
        tempoEventsCount: tempoIndex.tempoEventsCount,
        hasTempoChanges: tempoIndex.hasTempoChanges,
        segments: tempoIndex.segments
      }
    };
  }
  function tickToSecondsFromSegments(segments, tick) {
    const t = Number(tick);
    if (!Array.isArray(segments) || !Number.isFinite(t) || t < 0) return 0;
    if (!segments.length) return 0;
    let lo = 0;
    let hi = segments.length - 1;
    let idx = 0;
    while (lo <= hi) {
      const mid = lo + hi >> 1;
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

  // src/static/js/midi-core/export.js
  function pitchToName(pitch) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const p = Number(pitch);
    if (!Number.isFinite(p)) return "";
    const nn = (p % 12 + 12) % 12;
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
  var MIDI_INSPECTOR_EXPORT_SCHEMA_VERSION = "midieasy.midi-inspector.export.v0.1";
  function buildInspectorReport({ data, isPro, toolVersion, fileName, fileBytes }) {
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
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
        fileBytes: Number.isFinite(fileBytes) ? fileBytes : null
      },
      fileMeta: {
        divisionType: fileMeta.divisionType ?? "PPQ",
        ppq: fileMeta.ppq ?? null,
        tracksCount: fileMeta.tracksCount ?? 0,
        durationTicks: fileMeta.durationTicks ?? 0
      },
      tempo: {
        tempoMapReady: !!tempo.tempoMapReady,
        tempoEventsCount: tempo.tempoEventsCount ?? 0,
        hasTempoChanges: !!tempo.hasTempoChanges
      },
      quality: {
        overlapCount: quality.overlapCount ?? 0,
        danglingCount: quality.danglingCount ?? 0,
        orphanOffCount: quality.orphanOffCount ?? 0,
        unknownEventCount: quality.unknownEventCount ?? 0,
        hasSustainPedalEvents: !!quality.hasSustainPedalEvents,
        sampleErrors: Array.isArray(quality.sampleErrors) ? quality.sampleErrors : []
      }
    };
    if (!isPro) return base;
    const tracks = Array.isArray(data && data.tracks) ? data.tracks : [];
    const notes = Array.isArray(data && data.notes) ? data.notes : [];
    const events = Array.isArray(data && data.events) ? data.events : [];
    const notesByTrack = new Array(tracks.length).fill(0);
    const channelsUsed = /* @__PURE__ */ new Set();
    const programsUsed = /* @__PURE__ */ new Set();
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
        programsUsed: Array.from(programsUsed).sort((a, b) => a - b)
      },
      tracks: tracks.map((t, idx) => ({
        trackIndex: t.trackIndex,
        trackName: t.trackName || "",
        endTick: t.endTick ?? 0,
        notesCount: notesByTrack[idx] ?? 0
      }))
    };
  }
  function notesToInspectorCsv({ notes, includeSeconds }) {
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
      ...includeSec ? ["start_seconds", "duration_seconds"] : [],
      "velocity",
      "flags"
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
        ...includeSec ? [csvEscape(formatSeconds(n.start_seconds)), csvEscape(formatSeconds(n.duration_seconds))] : [],
        csvEscape(String(n.velocity ?? "")),
        csvEscape(flagsStr)
      ];
      lines.push(row.join(","));
    }
    return lines.join("\n") + "\n";
  }
  function filterNotes(notes, filters) {
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
  function filterEvents(events, filters) {
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
  function buildEventsJson({ events }) {
    const out = [];
    for (const e of Array.isArray(events) ? events : []) {
      out.push({
        tick: e.tick,
        kind: e.kind,
        trackIndex: e.trackIndex,
        channel: e.channel === null ? void 0 : e.channel,
        data: e.data || {}
      });
    }
    return out;
  }

  // src/static/js/midi-inspector/main.js
  var TOOL_VERSION = "0.1.0";
  var EVENTS_PER_PAGE = 200;
  var NOTES_PER_PAGE = 200;
  var FREE_EXPORT_NOTES_HARD_LIMIT = 2e5;
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
  function pitchToName2(pitch) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const p = Number(pitch);
    if (!Number.isFinite(p)) return "";
    const nn = (p % 12 + 12) % 12;
    const octave = Math.floor(p / 12) - 1;
    return `${names[nn]}${octave}`;
  }
  function formatSeconds2(sec) {
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
    return safeText(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function selectedToSet(selectEl) {
    if (!selectEl) return null;
    const set = /* @__PURE__ */ new Set();
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
      const bpm = uspb && uspb > 0 ? 6e7 / uspb : null;
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
      if (Number.isFinite(pitch) && Number.isFinite(vel)) return `${pitchToName2(pitch)} vel=${vel}`;
      return "noteOn";
    }
    if (e.kind === "noteOff") {
      const pitch = e.data ? e.data.pitch : null;
      const vel = e.data ? e.data.velocity : null;
      const v0 = e.data ? !!e.data.velocity0 : false;
      const extra = v0 ? " (v0)" : "";
      if (Number.isFinite(pitch) && Number.isFinite(vel)) return `${pitchToName2(pitch)} vel=${vel}${extra}`;
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
      bytes: null,
      data: null,
      parsing: false,
      activeTab: "events",
      showNoteEvents: false,
      noteEventsLoaded: false,
      cc64Only: true,
      eventTypeSet: /* @__PURE__ */ new Set(["tempo", "timeSig", "program", "cc"]),
      eventsPage: 1,
      notesPage: 1,
      filters: {
        trackSet: null,
        channelSet: null,
        pitchMin: null,
        pitchMax: null,
        tickStart: null,
        tickEnd: null,
        flags: null
      }
    };
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
      if (clearBtn) clearBtn.disabled = busy || !state.bytes && !state.data;
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
      const programs = /* @__PURE__ */ new Set();
      const channels = /* @__PURE__ */ new Set();
      for (const n of d.notes || []) {
        if (Number.isFinite(n.program)) programs.add(n.program);
        if (Number.isFinite(n.channel)) channels.add(n.channel);
      }
      const flags = [
        q.hasSustainPedalEvents ? "CC64" : null,
        tempo.hasTempoChanges ? "tempo changes" : null,
        (q.overlapCount || 0) > 0 ? `overlap=${q.overlapCount}` : null,
        (q.danglingCount || 0) > 0 ? `dangling=${q.danglingCount}` : null,
        (q.orphanOffCount || 0) > 0 ? `orphanOff=${q.orphanOffCount}` : null
      ].filter(Boolean);
      const insights = [];
      if (tempo.hasTempoChanges) insights.push("Tempo changes detected: prefer ticks for alignment and exports.");
      if (q.hasSustainPedalEvents) insights.push("CC64 (sustain) detected: durations may be shorter without sustain support.");
      if ((q.overlapCount || 0) > 0) insights.push("Overlapping notes detected: check legato/data quality.");
      if ((q.danglingCount || 0) > 0) insights.push("Dangling notes detected: noteOff missing; ended at track end.");
      if ((q.orphanOffCount || 0) > 0) insights.push("Orphan noteOff detected: noteOff without matching noteOn.");
      const insightsHtml = insights.length ? state.isPro ? `
          <div class="inspector-insights">
            <div class="inspector-insights__title">Quality Insights (Pro)</div>
            <ul class="inspector-insights__list">
              ${insights.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
            </ul>
          </div>
        ` : `
          <div class="inspector-insights inspector-insights--locked">
            <div class="inspector-insights__title">Quality Insights (Pro)</div>
            <div class="inspector-insights__locked">
              Issues detected. <a href="#pro-panel">Upgrade to Pro</a> to see explanations and export what you see.
            </div>
          </div>
        ` : "";
      summaryEl.innerHTML = `
      <div class="inspector-summary-grid">
        <div class="inspector-card">
          <div class="inspector-card__k">Duration</div>
          <div class="inspector-card__v">${escapeHtml(String(durationTicks))} ticks</div>
          <div class="inspector-card__s">${hasSeconds ? `${escapeHtml(formatSeconds2(durationSec))} s` : "— seconds (PPQ+tempo map required)"}</div>
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
      if (trackSelect) {
        const tracks = Array.isArray(state.data.tracks) ? state.data.tracks : [];
        trackSelect.innerHTML = tracks.map((t) => `<option value="${t.trackIndex}">${escapeHtml(String(t.trackIndex + 1))}${t.trackName ? ` · ${escapeHtml(t.trackName)}` : ""}</option>`).join("");
      }
      if (channelSelect) {
        const chSet = /* @__PURE__ */ new Set();
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
        hasSeconds
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
      const rows = slice.map((e) => {
        const seconds = hasSeconds ? formatSeconds2(tickToSecondsFromSegments(tempo.segments, e.tick)) : "";
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
      }).join("");
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
      const channelsByTrack = Array.from({ length: tracks.length }, () => /* @__PURE__ */ new Set());
      const programsByTrack = Array.from({ length: tracks.length }, () => /* @__PURE__ */ new Set());
      for (const n of notes) {
        if (!Number.isFinite(n.track_index)) continue;
        if (n.track_index < 0 || n.track_index >= tracks.length) continue;
        noteCountByTrack[n.track_index] += 1;
        if (Number.isFinite(n.channel)) channelsByTrack[n.track_index].add(n.channel);
        if (Number.isFinite(n.program)) programsByTrack[n.track_index].add(n.program);
      }
      const rows = tracks.map((t) => {
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
      }).join("");
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
      const rows = slice.map((n) => {
        const flags = buildNoteFlags(n);
        return `
          <tr>
            <td class="mono">${escapeHtml(String(Number(n.track_index) + 1))}</td>
            <td class="mono">${escapeHtml(String(n.channel ?? ""))}</td>
            <td class="mono">${escapeHtml(String(n.program ?? ""))}</td>
            <td class="mono">${escapeHtml(String(n.pitch ?? ""))}</td>
            <td class="mono">${escapeHtml(pitchToName2(n.pitch))}</td>
            <td class="mono">${escapeHtml(String(n.start_ticks ?? ""))}</td>
            <td class="mono">${escapeHtml(String(n.duration_ticks ?? ""))}</td>
            ${hasSeconds ? `<td class="mono">${escapeHtml(formatSeconds2(n.start_seconds))}</td><td class="mono">${escapeHtml(formatSeconds2(n.duration_seconds))}</td>` : ""}
            <td class="mono">${escapeHtml(String(n.velocity ?? ""))}</td>
            <td style="color:#666;">${escapeHtml(flags)}</td>
          </tr>
        `;
      }).join("");
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
          velocity0_noteoff: !!(flagVelocity0El && flagVelocity0El.checked)
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
        { kind: "noteOff", label: "noteOff" }
      ];
      eventsTypeFilterEl.innerHTML = types.map((t) => {
        const disabled = !state.showNoteEvents && (t.kind === "noteOn" || t.kind === "noteOff");
        const checked = state.eventTypeSet.has(t.kind);
        return `<label class="inspector-check"><input type="checkbox" data-kind="${escapeHtml(t.kind)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}/> ${escapeHtml(t.label)}</label>`;
      }).join("");
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
        fileBytes: state.file ? state.file.size : null
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
      const eventsFiltered = filterEvents(state.data.events, currentFilters({ forEvents: true })).filter((e) => e.kind !== "noteOn" && e.kind !== "noteOff");
      const out = buildEventsJson({ events: eventsFiltered });
      downloadBlob(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }), "events.json");
    }
    fileInput.addEventListener("change", (e) => {
      const f = e.target && e.target.files && e.target.files[0] ? e.target.files[0] : null;
      loadFile(f);
    });
    dropArea.addEventListener("click", () => fileInput.click());
    dropArea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
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
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0] ? e.dataTransfer.files[0] : null;
      loadFile(f);
    });
    if (inspectBtn) inspectBtn.addEventListener("click", onInspect);
    if (clearBtn) clearBtn.addEventListener("click", clearAll);
    if (resetFiltersBtn) resetFiltersBtn.addEventListener("click", resetFilters);
    [trackSelect, channelSelect, pitchMinEl, pitchMaxEl, tickStartEl, tickEndEl, flagOverlapEl, flagDanglingEl, flagVelocity0El].forEach((el) => {
      if (!el) return;
      el.addEventListener("change", () => syncFiltersFromUi({ resetPages: true }));
      el.addEventListener("input", () => syncFiltersFromUi({ resetPages: true }));
    });
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        if (!tab) return;
        setActiveTab(tab);
      });
    });
    if (eventsShowNotesEl) eventsShowNotesEl.addEventListener("change", onToggleNoteEvents);
    if (eventsCc64OnlyEl) {
      eventsCc64OnlyEl.addEventListener("change", () => {
        state.cc64Only = !!eventsCc64OnlyEl.checked;
        state.eventsPage = 1;
        renderEventsTab();
      });
    }
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
    if (exportReportBtn) exportReportBtn.addEventListener("click", exportReport);
    if (exportNotesBtn) exportNotesBtn.addEventListener("click", exportNotesCsv);
    if (exportEventsBtn) exportEventsBtn.addEventListener("click", exportEventsJson);
    globalThis.addEventListener("midieasy:pro-changed", updateProState);
    setActiveTab("events");
    renderEventTypeFilter();
    renderProHints();
    setBusy(false);
  }
  wireMidiInspectorPage();
})();
//# sourceMappingURL=midi-inspector.bundle.js.map
