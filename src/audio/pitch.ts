import { PitchDetector } from "pitchy";
import { centsFromMidi, frequencyToMidi, midiToFrequency } from "../music/pitch";

export interface PitchEstimate { frequencyHz: number; clarity: number; frameStartSample: number; frameEndSample: number }
export interface PitchEstimator { readonly id: string; readonly frameSize: number; estimate(frame: Float32Array, sampleRate: number): PitchEstimate | null }

export class MpmPitchEstimator implements PitchEstimator {
  readonly id = "mpm-pitchy";
  private detector: PitchDetector<Float32Array>;
  constructor(readonly frameSize = 4096) { this.detector = PitchDetector.forFloat32Array(frameSize); }
  estimate(frame: Float32Array, sampleRate: number): PitchEstimate | null {
    if (frame.length !== this.frameSize) return null;
    const [frequencyHz, clarity] = this.detector.findPitch(frame, sampleRate);
    return frequencyHz > 0 && Number.isFinite(frequencyHz) ? { frequencyHz, clarity, frameStartSample: 0, frameEndSample: frame.length } : null;
  }
}

export class AutocorrelationEstimator implements PitchEstimator {
  readonly id = "autocorrelation";
  constructor(readonly frameSize = 4096) {}
  estimate(frame: Float32Array, sampleRate: number): PitchEstimate | null {
    let rms = 0; for (const sample of frame) rms += sample * sample; rms = Math.sqrt(rms / frame.length);
    if (rms < 0.005) return null;
    const minLag = Math.floor(sampleRate / 1500), maxLag = Math.min(frame.length / 2, Math.ceil(sampleRate / 100));
    let bestLag = 0, best = -Infinity;
    for (let lag = minLag; lag <= maxLag; lag++) { let sum = 0, norm = 0; for (let i = 0; i < frame.length - lag; i++) { sum += frame[i]! * frame[i + lag]!; norm += frame[i]! * frame[i]!; } const score = sum / (norm || 1); if (score > best) { best = score; bestLag = lag; } }
    return bestLag && best > 0.35 ? { frequencyHz: sampleRate / bestLag, clarity: Math.min(1, best), frameStartSample: 0, frameEndSample: frame.length } : null;
  }
}

export class YinPitchEstimator implements PitchEstimator {
  readonly id = "yin";
  constructor(readonly frameSize = 4096, private readonly threshold = 0.12) {}
  estimate(frame: Float32Array, sampleRate: number): PitchEstimate | null {
    const half = Math.floor(frame.length / 2), diff = new Float32Array(half), cmnd = new Float32Array(half); let running = 0;
    for (let tau = 1; tau < half; tau++) { let value = 0; for (let i = 0; i < half; i++) { const delta = frame[i]! - frame[i + tau]!; value += delta * delta; } diff[tau] = value; running += value; cmnd[tau] = running ? value * tau / running : 1; }
    let tau = 2; while (tau < half && cmnd[tau]! >= this.threshold) tau++;
    if (tau >= half) return null;
    while (tau + 1 < half && cmnd[tau + 1]! < cmnd[tau]!) tau++;
    const frequencyHz = sampleRate / tau; return { frequencyHz, clarity: 1 - cmnd[tau]!, frameStartSample: 0, frameEndSample: frame.length };
  }
}

export interface SyntheticOptions { midi: number; durationSec: number; sampleRate?: number; harmonics?: number[]; noise?: number; vibratoCents?: number; detuneCents?: number; seed?: number }
export function syntheticTone(options: SyntheticOptions): Float32Array {
  const sampleRate = options.sampleRate ?? 48_000, length = Math.round(options.durationSec * sampleRate), output = new Float32Array(length), harmonics = options.harmonics ?? [1, .35, .15];
  let seed = options.seed ?? 42; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff) * 2 - 1;
  let phase = 0;
  for (let i = 0; i < length; i++) { const t = i / sampleRate, edge = Math.min(1, t / .04, (options.durationSec - t) / .06), vibrato = (options.vibratoCents ?? 0) * Math.sin(2 * Math.PI * 5.5 * t), frequency = midiToFrequency(options.midi + ((options.detuneCents ?? 0) + vibrato) / 100); phase += 2 * Math.PI * frequency / sampleRate; let value = 0; harmonics.forEach((gain, index) => value += gain * Math.sin(phase * (index + 1))); output[i] = edge * (value * .45 + random() * (options.noise ?? 0)); }
  return output;
}

export function analyzeFrames(pcm: Float32Array, sampleRate: number, estimator: PitchEstimator, hop = 256): Array<{ time: number; midiFloat: number; cents: number; clarity: number; rms: number }> {
  const result = [];
  for (let offset = 0; offset + estimator.frameSize <= pcm.length; offset += hop) { const frame = pcm.subarray(offset, offset + estimator.frameSize); let rms = 0; for (const x of frame) rms += x * x; rms = Math.sqrt(rms / frame.length); const estimate = estimator.estimate(frame, sampleRate); if (estimate && estimate.clarity > .7 && rms > .008) { const midiFloat = frequencyToMidi(estimate.frequencyHz); result.push({ time: offset / sampleRate, midiFloat, cents: centsFromMidi(midiFloat), clarity: estimate.clarity, rms }); } }
  return result;
}
