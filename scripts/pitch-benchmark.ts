import { mkdirSync, writeFileSync } from "node:fs";
import { AutocorrelationEstimator, MpmPitchEstimator, YinPitchEstimator, analyzeFrames, syntheticTone } from "../src/audio/pitch";

const fixtures=[
  {name:"clean-low",midi:48,harmonics:[1,.3,.1],noise:0},
  {name:"strong-second",midi:60,harmonics:[.2,1,.2],noise:.002},
  {name:"vibrato-mid",midi:69,harmonics:[1,.4,.2],noise:.006,vibratoCents:12},
  {name:"noisy-high",midi:84,harmonics:[1,.25,.1],noise:.02},
];
const estimators=[new MpmPitchEstimator(4096),new YinPitchEstimator(4096),new AutocorrelationEstimator(4096)];
const rows=[];
for(const fixture of fixtures)for(const estimator of estimators){const pcm=syntheticTone({...fixture,durationSec:1,sampleRate:48000,seed:42});const start=performance.now(),points=analyzeFrames(pcm,48000,estimator,256),elapsed=performance.now()-start,errors=points.map((point)=>Math.abs((point.midiFloat-fixture.midi)*100));rows.push({fixture:fixture.name,algorithm:estimator.id,frame:estimator.frameSize,hop:256,identityAccuracy:points.filter((p)=>Math.round(p.midiFloat)===fixture.midi).length/Math.max(1,points.length),medianAbsoluteCents:median(errors),p95Cents:percentile(errors,.95),stableFrames:points.length,processingMsPerFrame:elapsed/Math.max(1,points.length)});}
mkdirSync("docs/benchmarks",{recursive:true});writeFileSync("docs/benchmarks/pitch-synthetic.json",JSON.stringify({generatedAt:new Date().toISOString(),sampleRate:48000,rows},null,2));console.table(rows);
function median(values:number[]){return percentile(values,.5)}function percentile(values:number[],p:number){const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)]??0}
