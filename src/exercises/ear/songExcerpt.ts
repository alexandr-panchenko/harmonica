import type { Melody } from "../../music/melody";

export function songExcerpt(song: Melody, startMeasure = 0, measureCount = 2): Melody {
  const selected = song.events.filter(event => event.measureIndex >= startMeasure && event.measureIndex < startMeasure + measureCount);
  const firstBeat = selected[0]?.startBeat ?? 0;
  return { ...song, id:`${song.id}-excerpt-${startMeasure}`, title:song.title, events:selected.map((event,index)=>({ ...event, id:`excerpt-${index}`, startBeat:event.startBeat-firstBeat, measureIndex:event.measureIndex-startMeasure })) };
}
