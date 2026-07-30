import { midiToFrequency } from "../music/pitch";
import type { Melody } from "../music/melody";
import { OutputContaminationGuard } from "./OutputContaminationGuard";

interface SampleZone { midi: number; file: string; buffer?: AudioBuffer }
interface Voice { source: AudioScheduledSourceNode; gain: GainNode }
const ZONES: SampleZone[] = [60,64,67,72,76,79,84,88,91,96].map((midi, index) => ({ midi, file: ["c4","e4","g4","c5","e5","g5","c6","e6","g6","c7"][index]! }));

export class PlaybackEngine {
  private context?: AudioContext;
  private preloadPromise?: Promise<void>;
  private voices = new Map<string, Voice>();
  private pendingRelease = new Set<string>();
  private error?: string;
  readonly guard = new OutputContaminationGuard(180);
  async ready(): Promise<AudioContext> {
    this.context ??= new AudioContext({ latencyHint: "interactive" });
    if (this.context.state === "suspended") await this.context.resume();
    return this.context;
  }
  async preload(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadPromise = (async () => {
      const context = await this.ready();
      try {
        await Promise.all(ZONES.map(async (zone) => {
          const response = await fetch(`${import.meta.env.BASE_URL}audio/harmonica/${zone.file}.wav`);
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          zone.buffer = await context.decodeAudioData(await response.arrayBuffer());
        }));
      } catch (reason) {
        this.error = `Sampled harmonica unavailable; using oscillator fallback (${reason instanceof Error ? reason.message : String(reason)})`;
        throw reason;
      }
    })();
    return this.preloadPromise;
  }
  async noteOn(key: string, midi: number, at?: number): Promise<void> {
    const context = await this.ready();
    try { await this.preload(); } catch { /* explicit fallback below */ }
    const start = Math.max(context.currentTime, at ?? context.currentTime), gain = context.createGain();
    gain.connect(context.destination); gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.22, start + .035);
    let source: AudioScheduledSourceNode;
    const zone = nearestZone(midi);
    if (zone?.buffer) {
      const sampler = context.createBufferSource(); sampler.buffer = zone.buffer; sampler.playbackRate.value = 2 ** ((midi - zone.midi) / 12);
      sampler.loop = true; sampler.loopStart = Math.min(.7, zone.buffer.duration * .2); sampler.loopEnd = Math.max(sampler.loopStart + .25, zone.buffer.duration - .45); sampler.connect(gain); source = sampler;
    } else {
      const oscillator = context.createOscillator(); oscillator.type = "triangle"; oscillator.frequency.value = midiToFrequency(midi); oscillator.connect(gain); source = oscillator;
    }
    source.start(start); this.voices.get(key)?.source.stop(); this.voices.set(key, { source, gain }); this.guard.blockFor(60_000);
    source.addEventListener("ended", () => { if (this.voices.get(key)?.source === source) this.voices.delete(key); });
    if (this.pendingRelease.delete(key)) this.noteOff(key);
  }
  noteOff(key: string, at?: number): void {
    const voice = this.voices.get(key); if (!voice || !this.context) { this.pendingRelease.add(key); return; }
    const stopAt = Math.max(this.context.currentTime, at ?? this.context.currentTime); voice.gain.gain.cancelScheduledValues(stopAt); voice.gain.gain.setValueAtTime(Math.max(.001, voice.gain.gain.value), stopAt); voice.gain.gain.exponentialRampToValueAtTime(.001, stopAt + .12);
    try { voice.source.stop(stopAt + .14); } catch { /* already stopped */ }
    this.voices.delete(key); if (!this.voices.size) this.guard.releaseAfterTail();
  }
  async playNote(midi: number, durationSec = .7, at?: number): Promise<void> {
    const context = await this.ready(), start = at ?? context.currentTime, key = `scheduled-${midi}-${start}`;
    this.guard.blockFor(Math.max(0, start - context.currentTime) * 1000 + durationSec * 1000);
    await this.noteOn(key, midi, start); window.setTimeout(() => this.noteOff(key), Math.max(0, start - context.currentTime + durationSec) * 1000);
  }
  async playMelody(melody: Melody, tempoScale = 1, countInBeats = 0): Promise<number> {
    const context = await this.ready(), beatSec = 60 / (melody.tempoQpm * tempoScale), start = context.currentTime + .08 + countInBeats * beatSec;
    const endBeat = melody.events.reduce((end, event) => Math.max(end, event.startBeat + event.durationBeats), 0);
    this.guard.blockFor((start - context.currentTime + endBeat * beatSec) * 1000);
    for (const event of melody.events) if (event.kind === "note" && event.midi !== undefined) void this.playNote(event.midi, Math.max(.08, event.durationBeats * beatSec * .9), start + event.startBeat * beatSec);
    return start;
  }
  stop(): void {
    for (const { source } of this.voices.values()) { try { source.stop(); } catch { /* already stopped */ } }
    this.voices.clear(); this.pendingRelease.clear(); this.guard.releaseAfterTail();
  }
  get diagnostics(): { instrument: string; error?: string; sampleRate?: number; baseLatency?: number; outputLatency?: number } { return { instrument: this.error ? "oscillator fallback" : "VCSL Hohner Super 64 samples", error: this.error, sampleRate: this.context?.sampleRate, baseLatency: this.context?.baseLatency, outputLatency: this.context?.outputLatency }; }
}
function nearestZone(midi: number): SampleZone | undefined { return [...ZONES].sort((a, b) => Math.abs(a.midi - midi) - Math.abs(b.midi - midi))[0]; }
