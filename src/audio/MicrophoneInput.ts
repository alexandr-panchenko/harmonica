import { MpmPitchEstimator } from "./pitch";
import { frequencyToMidi } from "../music/pitch";
import { AdaptivePitchTracker, type TrackerFrame } from "./tracking";

export interface MicrophoneDiagnostics { sampleRate: number; constraints: MediaTrackConstraints; settings: MediaTrackSettings; baseLatency: number; outputLatency?: number }
export class MicrophoneInput {
  private stream?: MediaStream; private context?: AudioContext; private analyser?: AnalyserNode; private frame?: number; private estimator = new MpmPitchEstimator(4096); private tracker = new AdaptivePitchTracker();
  async start(onFrame: (frame: TrackerFrame | null) => void, deviceId?: string): Promise<MicrophoneDiagnostics> {
    this.stop();
    const constraints = { channelCount: { ideal: 1 }, echoCancellation: { ideal: false }, noiseSuppression: { ideal: false }, autoGainControl: { ideal: false }, latency: { ideal: .01 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } as MediaTrackConstraints;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: constraints }); this.context = new AudioContext({ latencyHint: "interactive" }); await this.context.resume();
    const source = this.context.createMediaStreamSource(this.stream), analyser = this.context.createAnalyser(); analyser.fftSize = 4096; source.connect(analyser); this.analyser = analyser;
    const pcm = new Float32Array(4096);
    const tick = () => { if (!this.analyser || !this.context) return; this.analyser.getFloatTimeDomainData(pcm); let rms = 0; for (const sample of pcm) rms += sample * sample; rms = Math.sqrt(rms / pcm.length); const estimate = this.estimator.estimate(pcm, this.context.sampleRate); onFrame(this.tracker.update({ time: this.context.currentTime * 1000, midiFloat: estimate ? frequencyToMidi(estimate.frequencyHz) : undefined, clarity: estimate?.clarity ?? 0, rms })); this.frame = requestAnimationFrame(tick); }; tick();
    return { sampleRate: this.context.sampleRate, constraints, settings: this.stream.getAudioTracks()[0]!.getSettings(), baseLatency: this.context.baseLatency, outputLatency: this.context.outputLatency };
  }
  stop(): void { if (this.frame) cancelAnimationFrame(this.frame); this.stream?.getTracks().forEach((track) => track.stop()); void this.context?.close(); this.stream = undefined; this.context = undefined; this.analyser = undefined; }
  static async devices(): Promise<MediaDeviceInfo[]> { return (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput"); }
}
