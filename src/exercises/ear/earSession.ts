import { relativeTargets } from "../evaluation";
import type { Melody } from "../../music/melody";

export type EarSource = "random" | "song";
export type EarMode = "absolute" | "relative";
export interface EarSessionState { phraseId:string; found:number[]; assisted:boolean; skipped:boolean; complete:boolean }

export class EarSession {
  state: EarSessionState;
  constructor(public phrase: Melody, public mode: EarMode = "relative") { this.state={phraseId:phrase.id,found:[],assisted:false,skipped:false,complete:false}; }
  answer(midi:number): {accepted:boolean;expected:number} {
    const targets=this.phrase.events.filter(event=>event.kind==="note").map(event=>event.midi!);
    const expectedTargets=this.mode==="relative"&&this.state.found.length?relativeTargets(targets,this.state.found[0]!):targets;
    const expected=this.mode==="relative"&&!this.state.found.length?midi:expectedTargets[this.state.found.length]??expectedTargets.at(-1)!;
    if(midi!==expected)return{accepted:false,expected};
    const found=[...this.state.found,midi];this.state={...this.state,found,complete:found.length===targets.length};return{accepted:true,expected};
  }
  reveal():void{const targets=this.phrase.events.filter(event=>event.kind==="note").map(event=>event.midi!);this.state={...this.state,found:targets,assisted:true,complete:true};}
  skip():void{this.state={...this.state,skipped:true};}
}
