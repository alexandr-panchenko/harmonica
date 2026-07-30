import type { TrackerFrame } from "../audio/tracking";
import type { MicrophoneObservation } from "../audio/MicrophoneInput";
import { centsFromMidi, clamp, noteName } from "../music/pitch";

export function Tuner({ frame, observation, message, expectedOffset = 0 }: { frame: TrackerFrame | null; observation?: MicrophoneObservation; message?: string; expectedOffset?: number }) {
  const cents = frame ? centsFromMidi(frame.midiFloat) : 0;
  const idle = message || (observation?.status === "calibrating" ? `Calibrating room noise · ${Math.round(observation.calibrationProgress * 100)}%` : observation?.status === "attack" ? "Tonal attack…" : observation?.status === "release" ? "Release…" : "Listening…");
  return <div className="tuner" aria-live="polite"><div className="tuner-readout"><strong>{frame ? noteName(frame.classifiedMidi) : "—"}</strong><span>{frame ? `${cents >= 0 ? "+" : ""}${Math.round(cents)} cents ET` : idle}</span><em>{frame ? `${frame.state}${expectedOffset ? ` · expected ${expectedOffset>0?"+":""}${Math.round(expectedOffset)}¢` : ""}` : observation?.status ?? "silence"}</em></div><div className={`tuner-scale ${frame ? "active" : "inactive"}`}><i className="expected-center" style={{left:`${50+clamp(expectedOffset,-50,50)}%`}}/>{frame && <i className="tuner-needle" style={{ left: `${50 + clamp(cents, -50, 50)}%` }}/>}<span>−50</span><span>0</span><span>+50</span></div><div className="level"><i style={{ width: `${clamp((observation?.rms ?? frame?.rms ?? 0) * 500, 0, 100)}%` }}/></div></div>;
}
