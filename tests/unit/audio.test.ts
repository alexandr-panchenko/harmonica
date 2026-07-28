import { describe, expect, test } from "bun:test";
import { AutocorrelationEstimator, MpmPitchEstimator, YinPitchEstimator, analyzeFrames, syntheticTone } from "../../src/audio/pitch";
import { AdaptivePitchTracker, NoteSegmenter } from "../../src/audio/tracking";

describe("deterministic audio",()=>{
  for(const Estimator of [MpmPitchEstimator,YinPitchEstimator,AutocorrelationEstimator]) test(`${Estimator.name} identifies a harmonic tone`,()=>{const pcm=syntheticTone({midi:60,durationSec:.5,harmonics:[.3,1,.2],noise:.002});const rows=analyzeFrames(pcm,48000,new Estimator(4096),512);expect(rows.length).toBeGreaterThan(5);expect(Math.round(rows.at(-1)!.midiFloat)).toBe(60)});
  test("noise below the gate produces no frames",()=>{const pcm=syntheticTone({midi:60,durationSec:.4,harmonics:[0],noise:.001});expect(analyzeFrames(pcm,48000,new MpmPitchEstimator(4096),256)).toHaveLength(0)});
  test("tracker requires stability and segmenter merges a short dropout",()=>{const tracker=new AdaptivePitchTracker(.005),segmenter=new NoteSegmenter(100);let stable;for(let i=0;i<5;i++)stable=tracker.update({time:i*20,midiFloat:60.02,clarity:.95,rms:.1});expect(stable?.state).toBe("stable");for(let i=0;i<8;i++)segmenter.update(stable!,i*20);expect(segmenter.update(null,250)).not.toBeNull()});
});
