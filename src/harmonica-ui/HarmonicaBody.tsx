import type { HarmonicaProfile } from "../harmonica/profile";
import type { VisualSlideState } from "./sliderState";
export function HarmonicaBody({profile,slider,children,compact=false}:{profile:HarmonicaProfile;slider:VisualSlideState;children:React.ReactNode;compact?:boolean}){return <div className={`product-harmonica ${compact?"compact":"interactive"}`} style={{"--product-holes":profile.holeCount} as React.CSSProperties}>
  <div className="product-cover" aria-hidden="true"><i/><i/><i/><span>CHROMATIC · C</span></div><div className="product-face"><span className="product-cap left"/>{children}<span className="product-cap right"/></div>
  <div className={`product-slider slider-${slider}`} role="img" aria-label={`Slider ${slider}`}><span/><i/></div><div className="product-shadow" aria-hidden="true"/>
  </div>}
