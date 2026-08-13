import { midiToFrequency } from "../music/pitch";
import type { Melody } from "../music/melody";
import { OutputContaminationGuard } from "./OutputContaminationGuard";
import { ReferencePlaybackSession } from "./ReferencePlaybackSession";

export type SampleZoneStatus = "idle" | "loading" | "sampled" | "failed";
interface SampleZone { midi: number; file: string; buffer?: AudioBuffer; status: SampleZoneStatus; error?: string }
interface Voice { source: AudioScheduledSourceNode; gain: GainNode; referenceSessionId?: number }
const SAMPLE_FILES=["c4","e4","g4","c5","e5","g5","c6","e6","g6","c7"] as const;
export type PlaybackInstrumentStatus = "loading" | "sampled" | "degraded";
type SampleFetch=(input:RequestInfo|URL)=>Promise<Response>;

export class PlaybackEngine {
  private context?: AudioContext;
  private preloadPromise?: Promise<void>;
  private zones: SampleZone[] = [60,64,67,72,76,79,84,88,91,96].map((midi, index) => ({ midi, file: SAMPLE_FILES[index]!, status:"idle" }));
  private voices = new Map<string, Voice>();
  private pendingRelease = new Set<string>();
  private referenceGeneration = 0;
  private referenceSession?: ReferencePlaybackSession;
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
    try { await this.preload(); } catch { /* explicit degraded fallback below */ }
    this.scheduleVoice(key,midi,start,start+durationSec);
    this.guard.blockFor(Math.max(0, start - context.currentTime + durationSec) * 1000);
  }
  async playMelody(melody: Melody, tempoScale = 1, countInBeats = 0): Promise<number> {
    const session=await this.startReferencePlayback(melody,0,tempoScale,countInBeats);
    return session?.state.startedAtAudioTime ?? (await this.ready()).currentTime;
  }
  async startReferencePlayback(melody: Melody, requestedStartBeat = 0, tempoScale = 1, countInBeats = 0): Promise<ReferencePlaybackSession | undefined> {
    this.stopReferencePlayback();
    const request = ++this.referenceGeneration, context = await this.ready();
    try { await this.preload(); } catch { /* explicit degraded fallback below */ }
    if (request !== this.referenceGeneration) return undefined;
    const endBeat=melody.events.reduce((end,event)=>Math.max(end,event.startBeat+event.durationBeats),0);
    const startedAtBeat=requestedStartBeat>=endBeat-.001?0:Math.max(0,Math.min(requestedStartBeat,endBeat));
    const beatSec=60/(melody.tempoQpm*tempoScale),startedAtAudioTime=context.currentTime+.06+countInBeats*beatSec;
    const session=new ReferencePlaybackSession({id:request,startedAtAudioTime,startedAtBeat,endBeat,tempoQpm:melody.tempoQpm*tempoScale});
    this.referenceSession=session;
    for(const event of melody.events){
      const eventEnd=event.startBeat+event.durationBeats;
      if(event.kind!=="note"||event.midi===undefined||eventEnd<=startedAtBeat)continue;
      const voiceStart=startedAtAudioTime+Math.max(0,event.startBeat-startedAtBeat)*beatSec;
      const voiceEnd=startedAtAudioTime+(eventEnd-startedAtBeat)*beatSec;
      this.scheduleVoice(`reference-${request}-${event.id}`,event.midi,voiceStart,voiceEnd,request);
    }
    this.guard.blockFor((startedAtAudioTime-context.currentTime+(endBeat-startedAtBeat)*beatSec)*1000);
    return session;
  }
  referenceSnapshot(): { status:"idle"|"playing"|"complete"; positionBeat:number; session?:ReferencePlaybackSession } {
    const session=this.referenceSession;
    if(!session||!this.context)return{status:"idle",positionBeat:0};
    const positionBeat=session.positionBeat(this.context.currentTime);
    if(session.isComplete(this.context.currentTime)){this.stopReferencePlayback(true);return{status:"complete",positionBeat,session}}
    return{status:"playing",positionBeat,session};
  }
  stopReferencePlayback(completed=false): void {
    this.referenceGeneration++;
    const session=this.referenceSession;this.referenceSession=undefined;
    if(session)for(const [key,voice] of this.voices){if(voice.referenceSessionId===session.state.id){try{voice.source.stop()}catch{/* already stopped */}this.voices.delete(key)}}
    if(!completed)this.guard.releaseAfterTail();
  }
  private scheduleVoice(key:string,midi:number,start:number,end:number,referenceSessionId?:number):void{
    const context=this.context!;const gain=context.createGain();gain.connect(context.destination);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.22,start+.035);
    let source:AudioScheduledSourceNode;const zone=nearestZone(this.zones,midi);
    if(zone?.buffer){const sampler=context.createBufferSource();sampler.buffer=zone.buffer;sampler.playbackRate.value=2**((midi-zone.midi)/12);sampler.loop=true;sampler.loopStart=Math.min(.7,zone.buffer.duration*.2);sampler.loopEnd=Math.max(sampler.loopStart+.25,zone.buffer.duration-.45);sampler.connect(gain);source=sampler}
    else{const oscillator=context.createOscillator();oscillator.type="triangle";oscillator.frequency.value=midiToFrequency(midi);oscillator.connect(gain);source=oscillator}
    const releaseAt=Math.max(start,end-.08);gain.gain.setValueAtTime(.22,releaseAt);gain.gain.exponentialRampToValueAtTime(.001,end+.1);source.start(start);source.stop(end+.12);
    this.voices.get(key)?.source.stop();this.voices.set(key,{source,gain,referenceSessionId});source.addEventListener("ended",()=>{if(this.voices.get(key)?.source===source)this.voices.delete(key)});
  }
  stop(): void {
    this.referenceGeneration++;this.referenceSession=undefined;
    for (const { source } of this.voices.values()) { try { source.stop(); } catch { /* already stopped */ } }
    this.voices.clear(); this.pendingRelease.clear(); this.guard.releaseAfterTail();
  }
  get diagnostics(): { status:PlaybackInstrumentStatus; instrument: string; error?: string; zones:Record<string,SampleZoneStatus>; zoneErrors:Record<string,string>; sampleRate?: number; baseLatency?: number; outputLatency?: number } {
    const sampled=this.zones.filter(zone=>zone.buffer).length,loading=this.zones.some(zone=>zone.status==="loading"||zone.status==="idle"),status:PlaybackInstrumentStatus=loading?"loading":sampled===this.zones.length?"sampled":"degraded";
    return { status, instrument: sampled?"VCSL Hohner Super 64 samples":"oscillator fallback", error:this.error,zones:Object.fromEntries(this.zones.map(zone=>[zone.file,zone.status])),zoneErrors:Object.fromEntries(this.zones.filter(zone=>zone.error).map(zone=>[zone.file,zone.error!])),sampleRate:this.context?.sampleRate,baseLatency:this.context?.baseLatency,outputLatency:this.context?.outputLatency };
  }
  get activeReferenceVoiceCount():number{return[...this.voices.values()].filter(voice=>voice.referenceSessionId!==undefined).length}
  get activeReferenceSessionCount():number{return this.referenceSession?1:0}
}
function nearestZone(zones:readonly SampleZone[],midi: number): SampleZone | undefined { return zones.filter(zone=>zone.buffer).sort((a, b) => Math.abs(a.midi - midi) - Math.abs(b.midi - midi))[0]; }
