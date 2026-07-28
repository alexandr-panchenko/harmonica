import type { TrackerFrame } from "../audio/tracking";
import { centsFromMidi, clamp, noteName } from "../music/pitch";

export function Tuner({ frame, message, expectedOffset = 0 }: { frame: TrackerFrame | null; message?: string; expectedOffset?: number }) {
  const cents = frame ? centsFromMidi(frame.midiFloat) : 0;
  return <div className="tuner" aria-live="polite"><div className="tuner-readout"><strong>{frame ? noteName(frame.classifiedMidi) : "—"}</strong><span>{frame ? `${cents >= 0 ? "+" : ""}${Math.round(cents)} cents ET` : message || "Listening…"}</span><em>{frame ? `${frame.state}${expectedOffset ? ` · expected ${expectedOffset>0?"+":""}${Math.round(expectedOffset)}¢` : ""}` : "silence"}</em></div><div className="tuner-scale"><i className="expected-center" style={{left:`${50+clamp(expectedOffset,-50,50)}%`}}/><i className="tuner-needle" style={{ left: `${50 + clamp(cents, -50, 50)}%` }}/><span>−50</span><span>0</span><span>+50</span></div><div className="level"><i style={{ width: `${clamp((frame?.rms ?? 0) * 500, 0, 100)}%` }}/></div></div>;
}
