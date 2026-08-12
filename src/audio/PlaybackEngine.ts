import { midiToFrequency } from "../music/pitch";
import type { Melody } from "../music/melody";
import { OutputContaminationGuard } from "./OutputContaminationGuard";

export type SampleZoneStatus = "idle" | "loading" | "sampled" | "failed";
interface SampleZone { midi: number; file: string; buffer?: AudioBuffer; status: SampleZoneStatus; error?: string }
interface Voice { source: AudioScheduledSourceNode; gain: GainNode }
const SAMPLE_FILES=["c4","e4","g4","c5","e5","g5","c6","e6","g6","c7"] as const;
export type PlaybackInstrumentStatus = "loading" | "sampled" | "degraded";
type SampleFetch=(input:RequestInfo|URL)=>Promise<Response>;

export class PlaybackEngine {
  private context?: AudioContext;
  private preloadPromise?: Promise<void>;
  private zones: SampleZone[] = [60,64,67,72,76,79,84,88,91,96].map((midi, index) => ({ midi, file: SAMPLE_FILES[index]!, status:"idle" }));
  private voices = new Map<string, Voice>();
  private pendingRelease = new Set<string>();
  private error?: string;
  readonly guard = new OutputContaminationGuard(180);
  constructor(private readonly contextFactory:()=>AudioContext=()=>new AudioContext({latencyHint:"interactive"}),private readonly sampleFetch:SampleFetch=(input)=>globalThis.fetch(input)){}
  async ready(): Promise<AudioContext> {
    this.context ??= this.contextFactory();
    if (this.context.state === "suspended") await this.context.resume();
    return this.context;
  }
  async preload(): Promise<void> {
    if (this.preloadPromise) return this.preloadPromise;
    this.preloadPromise = (async () => {
      const context = await this.ready();
      const pending=this.zones.filter(zone=>!zone.buffer);
      pending.forEach(zone=>{zone.status="loading";zone.error=undefined});
      const results=await Promise.allSettled(pending.map(async (zone) => {
          const response = await this.sampleFetch(`${import.meta.env.BASE_URL}audio/harmonica/${zone.file}.wav`);
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          zone.buffer = await context.decodeAudioData(await response.arrayBuffer());
          zone.status="sampled";
      }));
      results.forEach((result,index)=>{if(result.status==="rejected"){const zone=pending[index]!;zone.status="failed";zone.error=result.reason instanceof Error?result.reason.message:String(result.reason)}});
      const failed=this.zones.filter(zone=>zone.status==="failed");
      this.error=failed.length?`${failed.length} sampled zone${failed.length===1?"":"s"} unavailable; ${this.zones.some(zone=>zone.buffer)?"using nearest decoded sample":"using oscillator fallback"}`:undefined;
      if(!this.zones.some(zone=>zone.buffer))throw new Error(this.error);
    })();
    try { await this.preloadPromise; } finally { if(this.zones.some(zone=>zone.status==="failed"))this.preloadPromise=undefined; }
  }
  async noteOn(key: string, midi: number, at?: number): Promise<void> {
    const context = await this.ready();
    try { await this.preload(); } catch { /* explicit fallback below */ }
    const start = Math.max(context.currentTime, at ?? context.currentTime), gain = context.createGain();
    gain.connect(context.destination); gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.22, start + .035);
    let source: AudioScheduledSourceNode;
    const zone = nearestZone(this.zones,midi);
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
    await this.noteOn(key, midi, start); globalThis.setTimeout(() => this.noteOff(key), Math.max(0, start - context.currentTime + durationSec) * 1000);
  }
  async playMelody(melody: Melody, tempoScale = 1, countInBeats = 0): Promise<number> {
    const context = await this.ready();
    try{await this.preload()}catch{/* noteOn uses the explicit degraded fallback */}
    const beatSec = 60 / (melody.tempoQpm * tempoScale), start = context.currentTime + .08 + countInBeats * beatSec;
    const endBeat = melody.events.reduce((end, event) => Math.max(end, event.startBeat + event.durationBeats), 0);
    this.guard.blockFor((start - context.currentTime + endBeat * beatSec) * 1000);
    await Promise.all(melody.events.filter(event=>event.kind==="note"&&event.midi!==undefined).map(event=>this.playNote(event.midi!,Math.max(.08,event.durationBeats*beatSec*.9),start+event.startBeat*beatSec)));
    return start;
  }
  stop(): void {
    for (const { source } of this.voices.values()) { try { source.stop(); } catch { /* already stopped */ } }
    this.voices.clear(); this.pendingRelease.clear(); this.guard.releaseAfterTail();
  }
  get diagnostics(): { status:PlaybackInstrumentStatus; instrument: string; error?: string; zones:Record<string,SampleZoneStatus>; zoneErrors:Record<string,string>; sampleRate?: number; baseLatency?: number; outputLatency?: number } {
    const sampled=this.zones.filter(zone=>zone.buffer).length,loading=this.zones.some(zone=>zone.status==="loading"||zone.status==="idle"),status:PlaybackInstrumentStatus=loading?"loading":sampled===this.zones.length?"sampled":"degraded";
    return { status, instrument: sampled?"VCSL Hohner Super 64 samples":"oscillator fallback", error:this.error,zones:Object.fromEntries(this.zones.map(zone=>[zone.file,zone.status])),zoneErrors:Object.fromEntries(this.zones.filter(zone=>zone.error).map(zone=>[zone.file,zone.error!])),sampleRate:this.context?.sampleRate,baseLatency:this.context?.baseLatency,outputLatency:this.context?.outputLatency };
  }
}
function nearestZone(zones:readonly SampleZone[],midi: number): SampleZone | undefined { return zones.filter(zone=>zone.buffer).sort((a, b) => Math.abs(a.midi - midi) - Math.abs(b.midi - midi))[0]; }
