import { frequencyToMidi } from "../music/pitch";
import type { InputNoteSegment } from "../exercises/evaluation";
import { LivePitchState, type MicrophoneFrameBundle } from "./LivePitchState";
import { MpmPitchEstimator, type PitchEstimator } from "./pitch";
import { AdaptivePitchTracker, NoteSegmenter, type MicrophoneSensitivity } from "./tracking";

/** One frame adapter shared by microphone capture, decoded recordings, and synthetic fixtures. */
export class ProductionAudioPipeline {
  readonly live: LivePitchState;
  constructor(readonly sensitivity:MicrophoneSensitivity="normal",readonly estimator:PitchEstimator=new MpmPitchEstimator(4096)){
    this.live=new LivePitchState(new AdaptivePitchTracker(.004,.7,[58,99],sensitivity));
  }
  processFrame(pcm:Float32Array,sampleRate:number,timeMs:number):MicrophoneFrameBundle{
    let rms=0;for(const sample of pcm)rms+=sample*sample;rms=Math.sqrt(rms/pcm.length);
    const estimate=this.live.tracker.shouldEstimate(rms)?this.estimator.estimate(pcm,sampleRate):null;
    return this.live.update({time:timeMs,frequencyHz:estimate?.frequencyHz,midiFloat:estimate?frequencyToMidi(estimate.frequencyHz):undefined,clarity:estimate?.clarity??0,rms});
  }
  reset():void{this.live.reset()}
}

export function analyzePcmThroughProduction(pcm:Float32Array,sampleRate:number,sensitivity:MicrophoneSensitivity="normal",hop=512):{bundles:MicrophoneFrameBundle[];segments:InputNoteSegment[]}{
  const pipeline=new ProductionAudioPipeline(sensitivity),segmenter=new NoteSegmenter(),bundles:MicrophoneFrameBundle[]=[],segments:InputNoteSegment[]=[];
  pipeline.live.tracker.calibrateNoise(Array.from({length:40},()=>.001));
  for(let offset=0;offset+pipeline.estimator.frameSize<=pcm.length;offset+=hop){const time=offset/sampleRate*1000,bundle=pipeline.processFrame(pcm.subarray(offset,offset+pipeline.estimator.frameSize),sampleRate,time);bundles.push(bundle);const completed=segmenter.update(bundle.accepted??null,time);if(completed)segments.push(completed)}
  const completed=segmenter.update(null,pcm.length/sampleRate*1000+400);if(completed)segments.push(completed);return{bundles,segments};
}
