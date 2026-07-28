import { midiToFrequency } from "../music/pitch";
import type { Melody } from "../music/melody";

export class PlaybackEngine {
  private context?: AudioContext;
  private sources = new Set<OscillatorNode>();
  async ready(): Promise<AudioContext> {
    this.context ??= new AudioContext({ latencyHint: "interactive" });
    if (this.context.state === "suspended") await this.context.resume();
    return this.context;
  }
  async playNote(midi: number, durationSec = .7, at?: number): Promise<void> {
    const context = await this.ready(), start = at ?? context.currentTime, oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = "triangle"; oscillator.frequency.value = midiToFrequency(midi); oscillator.connect(gain); gain.connect(context.destination);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.18, start + .025); gain.gain.exponentialRampToValueAtTime(.001, start + durationSec);
    oscillator.start(start); oscillator.stop(start + durationSec + .02); this.sources.add(oscillator); oscillator.onended = () => this.sources.delete(oscillator);
  }
  async playMelody(melody: Melody, tempoScale = 1, countInBeats = 0): Promise<number> {
    const context = await this.ready(), beatSec = 60 / (melody.tempoQpm * tempoScale), start = context.currentTime + .08 + countInBeats * beatSec;
    for (const event of melody.events) if (event.kind === "note" && event.midi !== undefined) void this.playNote(event.midi, Math.max(.08, event.durationBeats * beatSec * .9), start + event.startBeat * beatSec);
    return start;
  }
  stop(): void { for (const source of this.sources) { try { source.stop(); } catch { /* already stopped */ } } this.sources.clear(); }
  get diagnostics(): { sampleRate?: number; baseLatency?: number; outputLatency?: number } { return { sampleRate: this.context?.sampleRate, baseLatency: this.context?.baseLatency, outputLatency: this.context?.outputLatency }; }
}
