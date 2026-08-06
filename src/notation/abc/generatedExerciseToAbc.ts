import type { MelodyEvent, WrittenPitch } from "../../music/melody";

const pitchToken=(pitch:WrittenPitch)=>{let letter=pitch.step,marks="";if(pitch.octave>=5){letter=letter.toLowerCase() as WrittenPitch["step"];marks="'".repeat(Math.max(0,pitch.octave-5))}else marks=",".repeat(Math.max(0,4-pitch.octave));const accidental=pitch.accidental==="sharp"?"^":pitch.accidental==="flat"?"_":pitch.accidental==="natural"?"=":"";return`${accidental}${letter}${marks}`};
const durationToken=(beats:number)=>Math.abs(beats-1)<.0001?"":Number.isInteger(beats)?String(beats):beats===.5?"/2":beats===.25?"/4":beats===1.5?"3/2":String(beats);

export function generatedExerciseToAbc(events:readonly MelodyEvent[],options:{title?:string;meter?:{numerator:number;denominator:number};tempoQpm?:number}={}):string{
  const meter=options.meter??{numerator:4,denominator:4};let measure=-1;const tokens:string[]=[];
  for(const event of events){if(event.measureIndex!==measure){if(measure>=0)tokens.push("|");measure=event.measureIndex}const token=event.kind==="rest"?"z":pitchToken(event.writtenPitch??{step:"C",octave:4});tokens.push(`${token}${durationToken(event.durationBeats)}${event.tie==="start"||event.tie==="continue"?"-":""}`)}
  return`X:1\nT:${options.title??"Generated exercise"}\nM:${meter.numerator}/${meter.denominator}\nL:1/4\nQ:1/4=${options.tempoQpm??100}\nK:C\n${tokens.join(" ")} |`;
}
