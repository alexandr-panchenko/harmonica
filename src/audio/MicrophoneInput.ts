import { MpmPitchEstimator } from "./pitch";
import { frequencyToMidi } from "../music/pitch";
import { AdaptivePitchTracker, type SignalState, type TrackerFrame } from "./tracking";

export interface MicrophoneDiagnostics { sampleRate: number; constraints: MediaTrackConstraints; settings: MediaTrackSettings; baseLatency: number; outputLatency?: number }
export interface MicrophoneObservation { status: "calibrating" | SignalState; rms: number; noiseFloor: number; openThreshold: number; calibrationProgress: number }

export class MicrophoneInput {
  private stream?: MediaStream; private context?: AudioContext; private analyser?: AnalyserNode; private frame?: number;
  private estimator = new MpmPitchEstimator(4096); private tracker = new AdaptivePitchTracker();
  private calibrationStartedAt = 0; private calibrationSamples: number[] = []; private calibrating = true;
  async start(onFrame: (frame: TrackerFrame | null, observation?: MicrophoneObservation) => void, deviceId?: string): Promise<MicrophoneDiagnostics> {
    this.stop(); this.tracker = new AdaptivePitchTracker(); this.beginCalibration();
    const constraints = { channelCount: { ideal: 1 }, echoCancellation: { ideal: false }, noiseSuppression: { ideal: false }, autoGainControl: { ideal: false }, latency: { ideal: .01 }, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } as MediaTrackConstraints;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: constraints }); this.context = new AudioContext({ latencyHint: "interactive" }); await this.context.resume();
    const source = this.context.createMediaStreamSource(this.stream), analyser = this.context.createAnalyser(); analyser.fftSize = 4096; source.connect(analyser); this.analyser = analyser;
    const pcm = new Float32Array(4096);
    const tick = () => {
      if (!this.analyser || !this.context) return;
      this.analyser.getFloatTimeDomainData(pcm); let rms = 0; for (const sample of pcm) rms += sample * sample; rms = Math.sqrt(rms / pcm.length);
      const now = performance.now();
      if (this.calibrating) {
        this.calibrationSamples.push(rms);
        const elapsed = now - this.calibrationStartedAt;
        if (elapsed >= 750) { this.tracker.calibrateNoise(this.calibrationSamples); this.calibrating = false; }
        onFrame(null, this.observation("calibrating", rms, Math.min(1, elapsed / 750)));
      } else {
        const estimate = this.tracker.shouldEstimate(rms) ? this.estimator.estimate(pcm, this.context.sampleRate) : null;
        const tracked = this.tracker.update({ time: now, midiFloat: estimate ? frequencyToMidi(estimate.frequencyHz) : undefined, clarity: estimate?.clarity ?? 0, rms });
        const visible = tracked?.state === "stable" ? tracked : null;
        onFrame(visible, this.observation(this.tracker.lastState, rms, 1));
      }
      this.frame = requestAnimationFrame(tick);
    };
    tick();
    return { sampleRate: this.context.sampleRate, constraints, settings: this.stream.getAudioTracks()[0]!.getSettings(), baseLatency: this.context.baseLatency, outputLatency: this.context.outputLatency };
  }
  recalibrate(): void { if (this.analyser) this.beginCalibration(); }
  resetTracker(): void { this.tracker.reset(); }
  private beginCalibration(): void { this.calibrating = true; this.calibrationStartedAt = performance.now(); this.calibrationSamples = []; this.tracker.reset(); }
  private observation(status: MicrophoneObservation["status"], rms: number, calibrationProgress: number): MicrophoneObservation { return { status, rms, noiseFloor: this.tracker.noiseFloor, openThreshold: this.tracker.openThreshold, calibrationProgress }; }
  stop(): void { if (this.frame) cancelAnimationFrame(this.frame); this.stream?.getTracks().forEach((track) => track.stop()); void this.context?.close(); this.stream = undefined; this.context = undefined; this.analyser = undefined; this.frame = undefined; }
  static async devices(): Promise<MediaDeviceInfo[]> { return (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput"); }
}
