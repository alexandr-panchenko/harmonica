import {describe,expect,test} from "bun:test";
import {PlaybackEngine} from "../../src/audio/PlaybackEngine";
import type {Melody} from "../../src/music/melody";

function fakeAudio(){
  const calls={buffers:0,oscillators:0,starts:[] as number[]};
  const param={value:1,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},exponentialRampToValueAtTime(){}};
  const source=()=>({connect(){},start(at=0){calls.starts.push(at)},stop(){},addEventListener(){}});
  const context={state:"running",currentTime:2,destination:{},sampleRate:48000,baseLatency:.01,outputLatency:.02,resume:async()=>{},decodeAudioData:async()=>({duration:2}),createGain:()=>({connect(){},gain:{...param}}),createBufferSource:()=>{calls.buffers++;return{...source(),buffer:undefined,playbackRate:{value:1},loop:false,loopStart:0,loopEnd:0}},createOscillator:()=>{calls.oscillators++;return{...source(),type:"triangle",frequency:{value:0}}}};
  return{calls,context:context as unknown as AudioContext};
}
const ok=()=>Promise.resolve(new Response(new Uint8Array([1,2,3]),{status:200,headers:{"content-type":"audio/wav"}}));

describe("sampled playback",()=>{
  test("healthy playback uses AudioBufferSourceNode and never oscillator",async()=>{const audio=fakeAudio(),engine=new PlaybackEngine(()=>audio.context,ok);await engine.preload();await engine.noteOn("healthy",67);expect(audio.calls.buffers).toBe(1);expect(audio.calls.oscillators).toBe(0);expect(engine.diagnostics.status).toBe("sampled")});
  test("one failed zone stays degraded but uses the nearest decoded sample",async()=>{const audio=fakeAudio(),fetcher=(input:RequestInfo|URL)=>String(input).includes("c4.wav")?Promise.resolve(new Response(null,{status:503})):ok();const engine=new PlaybackEngine(()=>audio.context,fetcher);await engine.preload();await engine.noteOn("partial",60);expect(engine.diagnostics.status).toBe("degraded");expect(audio.calls.buffers).toBe(1);expect(audio.calls.oscillators).toBe(0)});
  test("a wholly rejected preload can retry and melody scheduling waits for samples",async()=>{const audio=fakeAudio();let healthy=false;const fetcher=(_input:RequestInfo|URL)=>healthy?ok():Promise.resolve(new Response(null,{status:503}));const engine=new PlaybackEngine(()=>audio.context,fetcher);await expect(engine.preload()).rejects.toThrow();healthy=true;await engine.preload();const melody:Melody={id:"test",title:"Test",meter:{numerator:4,denominator:4},tempoQpm:120,events:[{id:"a",kind:"note",midi:60,startBeat:0,durationBeats:1,measureIndex:0}]};await engine.playMelody(melody);expect(engine.diagnostics.status).toBe("sampled");expect(audio.calls.buffers).toBe(1);expect(audio.calls.oscillators).toBe(0)});
});
