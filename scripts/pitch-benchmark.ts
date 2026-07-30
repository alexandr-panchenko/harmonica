import { mkdirSync, writeFileSync } from "node:fs";
import { AutocorrelationEstimator, MpmPitchEstimator, YinPitchEstimator, analyzeFrames, syntheticTone } from "../src/audio/pitch";
import { AdaptivePitchTracker, NoteSegmenter } from "../src/audio/tracking";

const fixtures=[
  {name:"clean-low",midi:48,harmonics:[1,.3,.1],noise:0},
  {name:"strong-second",midi:60,harmonics:[.2,1,.2],noise:.002},
  {name:"vibrato-mid",midi:69,harmonics:[1,.4,.2],noise:.006,vibratoCents:12},
  {name:"noisy-high",midi:84,harmonics:[1,.25,.1],noise:.02},
];
const estimators=[new MpmPitchEstimator(4096),new YinPitchEstimator(4096),new AutocorrelationEstimator(4096)];
const rows=[];
for(const fixture of fixtures)for(const estimator of estimators){const pcm=syntheticTone({...fixture,durationSec:1,sampleRate:48000,seed:42});const start=performance.now(),points=analyzeFrames(pcm,48000,estimator,256),elapsed=performance.now()-start,errors=points.map((point)=>Math.abs((point.midiFloat-fixture.midi)*100));rows.push({fixture:fixture.name,algorithm:estimator.id,frame:estimator.frameSize,hop:256,identityAccuracy:points.filter((p)=>Math.round(p.midiFloat)===fixture.midi).length/Math.max(1,points.length),medianAbsoluteCents:median(errors),p95Cents:percentile(errors,.95),stableFrames:points.length,processingMsPerFrame:elapsed/Math.max(1,points.length)});}
const gateFixtures=[
  {name:"quiet-colored-noise",frames:Array.from({length:50},(_,i)=>({midiFloat:58+(i*7)%35,clarity:.2+(i%3)*.08,rms:.012}))},
  {name:"breath-noise",frames:Array.from({length:50},(_,i)=>({midiFloat:65+(i%9)-4,clarity:.25,rms:.018}))},
  {name:"short-click",frames:[{midiFloat:84,clarity:.91,rms:.3},...Array.from({length:12},()=>({midiFloat:undefined,clarity:0,rms:.002}))]},
  {name:"threshold-harmonic",frames:Array.from({length:30},(_,i)=>({midiFloat:60+Math.sin(i/3)*.04,clarity:.94,rms:.025}))},
  {name:"vibrato-bend",frames:Array.from({length:45},(_,i)=>({midiFloat:60+i/90+Math.sin(i/2)*.06,clarity:.92,rms:.06}))},
];
const gateRows=gateFixtures.map((fixture)=>{const tracker=new AdaptivePitchTracker();tracker.calibrateNoise(Array.from({length:50},(_,i)=>.009+(i%5)*.0005));const segmenter=new NoteSegmenter(100);let stableFrames=0,segments=0;fixture.frames.forEach((point,index)=>{const frame=tracker.update({time:index*16,...point});if(frame?.state==="stable")stableFrames++;if(segmenter.update(frame,index*16))segments++});if(segmenter.update(null,fixture.frames.length*16+120))segments++;return{fixture:fixture.name,legacyVisibleFrames:fixture.frames.filter((point)=>point.rms>.004&&point.midiFloat!==undefined).length,stableFrames,stableSegments:segments};});
mkdirSync("docs/benchmarks",{recursive:true});writeFileSync("docs/benchmarks/pitch-synthetic.json",JSON.stringify({generatedAt:new Date().toISOString(),sampleRate:48000,rows,gateRows},null,2));console.table(rows);console.table(gateRows);
function median(values:number[]){return percentile(values,.5)}function percentile(values:number[],p:number){const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)]??0}
