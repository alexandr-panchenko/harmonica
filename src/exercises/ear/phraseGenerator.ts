import type { HarmonicaProfile } from "../../harmonica/profile";
import { writtenPitchFromMidi } from "../../notation/layout";
import type { Melody, MelodyEvent } from "../../music/melody";

export interface RandomPhraseSettings { length: number; maxInterval: number; tempoQpm: number }

export function generateRandomPhrase(profile: HarmonicaProfile, settings: RandomPhraseSettings, random: () => number = Math.random): Melody {
  const pitches = [...new Set(profile.physicalActions.map(action => action.canonicalMidi))].sort((a,b)=>a-b);
  const events: MelodyEvent[] = [];
  let midi = pitches[Math.floor(random() * pitches.length)] ?? pitches[0]!;
  for (let index=0; index<settings.length; index++) {
    const playable = pitches.filter(value => Math.abs(value-midi) <= settings.maxInterval && (index === 0 || value !== midi));
    if (index) midi = playable[Math.floor(random()*playable.length)] ?? midi;
    events.push({ id:`ear-${index}`, kind:"note", midi, writtenPitch:writtenPitchFromMidi(midi), startBeat:index, durationBeats:1, measureIndex:Math.floor(index/4) });
  }
  return { id:`random-${events.map(event=>event.midi).join("-")}`, title:"Random phrase", tempoQpm:settings.tempoQpm, meter:{numerator:4,denominator:4}, events, source:{type:"legacy"} };
}
