import type { MicrophoneSensitivity } from "./tracking";
import type { MicrophoneFrameBundle } from "./LivePitchState";
import { ProductionAudioPipeline } from "./ProductionAudioPipeline";

export interface MicrophoneDiagnostics { sampleRate: number; constraints: MediaTrackConstraints; settings: MediaTrackSettings; baseLatency: number; outputLatency?: number }
export interface MicrophoneObservation { status: "calibrating" | "calibration-contaminated" | MicrophoneFrameBundle["signalState"]; rms: number; rmsDb: number; noiseFloorDb: number; openThresholdDb: number; closeThresholdDb: number; clarity: number; gateOpen: boolean; calibrationProgress: number; sensitivity: MicrophoneSensitivity }

export class MicrophoneInput {
  private stream?: MediaStream; private context?: AudioContext; private analyser?: AnalyserNode; private frame?: number;
  private pipeline:ProductionAudioPipeline;
  private calibrationStartedAt = 0; private calibrationSamples: number[] = []; private calibrationTonal = 0; private calibrating = true; private contaminatedUntil = 0;
  constructor(private sensitivity: MicrophoneSensitivity = "normal") { this.pipeline=new ProductionAudioPipeline(sensitivity); }
  async start(onFrame: (bundle: MicrophoneFrameBundle, observation: MicrophoneObservation) => void, deviceId?: string): Promise<MicrophoneDiagnostics> {
    this.stop(); this.pipeline=new ProductionAudioPipeline(this.sensitivity); this.beginCalibration();
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
        const calibrationEstimate = rms > .001 ? this.pipeline.estimator.estimate(pcm, this.context.sampleRate) : null;
        if (calibrationEstimate && calibrationEstimate.clarity >= .78) this.calibrationTonal++;
        const elapsed = now - this.calibrationStartedAt;
        if (elapsed >= 900) {
          if (this.calibrationIsContaminated()) { this.contaminatedUntil = now + 650; this.beginCalibration(false); }
          else { this.pipeline.live.tracker.calibrateNoise(this.calibrationSamples); this.calibrating = false; }
        }
        const bundle = this.pipeline.live.update({ time: now, clarity: 0, rms });
        onFrame(bundle, this.observation(now < this.contaminatedUntil ? "calibration-contaminated" : "calibrating", bundle, Math.min(1, elapsed / 900)));
      } else {
        const bundle = this.pipeline.processFrame(pcm,this.context.sampleRate,now);
        onFrame(bundle, this.observation(bundle.signalState, bundle, 1));
      }
      this.frame = requestAnimationFrame(tick);
    };
    tick();
    return { sampleRate: this.context.sampleRate, constraints, settings: this.stream.getAudioTracks()[0]!.getSettings(), baseLatency: this.context.baseLatency, outputLatency: this.context.outputLatency };
  }
  recalibrate(): void { if (this.analyser) this.beginCalibration(); }
  setSensitivity(sensitivity: MicrophoneSensitivity): void { this.sensitivity = sensitivity; this.pipeline.live.tracker.setSensitivity(sensitivity); }
  resetTracker(): void { this.pipeline.reset(); }
  private beginCalibration(clearContamination = true): void { this.calibrating = true; this.calibrationStartedAt = performance.now(); this.calibrationSamples = []; this.calibrationTonal = 0; if (clearContamination) this.contaminatedUntil = 0; this.pipeline.reset(); }
  private calibrationIsContaminated(): boolean {
    return calibrationLooksContaminated(this.calibrationSamples,this.calibrationTonal);
  }
  private observation(status: MicrophoneObservation["status"], bundle: MicrophoneFrameBundle, calibrationProgress: number): MicrophoneObservation { return { status, rms: bundle.gate.rms, rmsDb: bundle.gate.rmsDb, noiseFloorDb: bundle.gate.noiseFloorDb, openThresholdDb: bundle.gate.openThresholdDb, closeThresholdDb: bundle.gate.closeThresholdDb, clarity: bundle.gate.confidence, gateOpen: bundle.gate.isOpen, calibrationProgress, sensitivity: bundle.gate.sensitivity }; }
  stop(): void { if (this.frame) cancelAnimationFrame(this.frame); this.stream?.getTracks().forEach((track) => track.stop()); void this.context?.close(); this.stream = undefined; this.context = undefined; this.analyser = undefined; this.frame = undefined; }
  static async devices(): Promise<MediaDeviceInfo[]> { return (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "audioinput"); }
}
export function calibrationLooksContaminated(samples:readonly number[],tonalFrames:number):boolean{const sorted=[...samples].sort((a,b)=>a-b),low=sorted[Math.floor(sorted.length*.2)]??0,high=sorted[Math.floor(sorted.length*.9)]??0;return tonalFrames>samples.length*.18||(low>0&&high/low>3.5)}
