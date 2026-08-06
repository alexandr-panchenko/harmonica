import type { HarmonicaAction,HarmonicaProfile } from "../harmonica/profile";
import type { NamingSystem } from "../music/naming";
import { CompactHarmonicaView } from "./CompactHarmonicaView";
import { InteractiveHarmonicaView } from "./InteractiveHarmonicaView";
export function HarmonicaStage(props:{view:"compact"|"interactive";profile:HarmonicaProfile;target?:HarmonicaAction;detected?:HarmonicaAction[];onStart:(action:HarmonicaAction)=>void;onEnd:(action:HarmonicaAction,durationMs:number)=>void;showLabels?:boolean;namingSystem?:NamingSystem;feedback?:{actionId:string;outcome:"correct"|"incorrect"}}){return props.view==="compact"?<CompactHarmonicaView profile={props.profile} target={props.target} detected={props.detected} feedback={props.feedback?.outcome} showLabels={props.showLabels} namingSystem={props.namingSystem}/>:<InteractiveHarmonicaView {...props}/>}
