export interface WrittenPitch { step: string; accidental?: "sharp" | "flat" | "natural"; octave: number }
export interface MelodyEvent {
  id: string;
  kind: "note" | "rest";
  startBeat: number;
  durationBeats: number;
  midi?: number;
  writtenPitch?: WrittenPitch;
  tie?: "start" | "continue" | "end";
  measureIndex: number;
  sourceRange?: { start: number; end: number };
}
export interface Melody {
  id: string;
  title: string;
  composer?: string;
  tempoQpm: number;
  meter: { numerator: number; denominator: number };
  pickupBeats?: number;
  events: MelodyEvent[];
  source?: { type: "abc" | "builtin" | "legacy"; raw?: string };
}

export const SONGS: Record<string, { title: string; abc: string }> = {
  twinkle: { title: "Twinkle Twinkle", abc: "X:1\nT:Twinkle Twinkle\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\nC C G G | A A G2 | F F E E | D D C2 |" },
  ode: { title: "Ode to Joy", abc: "X:1\nT:Ode to Joy\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\nE E F G | G F E D | C C D E | E3/2 D/2 D2 |" },
  birthday: { title: "Happy Birthday", abc: "X:1\nT:Happy Birthday\nM:3/4\nL:1/4\nQ:1/4=90\nK:C\nC3/2 C/2 D C | F E2 | C3/2 C/2 D C | G F2 |" },
  grace: { title: "Amazing Grace", abc: "X:1\nT:Amazing Grace\nM:3/4\nL:1/4\nQ:1/4=76\nK:C\nC | F2 A/2 F/2 | A2 G | F2 D | C3 |" },
  scarborough: { title: "Scarborough Fair", abc: "X:1\nT:Scarborough Fair\nM:3/4\nL:1/4\nQ:1/4=90\nK:C\nD2 D | A2 A | E3/2 F/2 D | A3 | B2 c | d2 c | A2 B | G3 |" },
  greensleeves: { title: "Greensleeves", abc: "X:1\nT:Greensleeves\nM:6/8\nL:1/8\nQ:3/8=80\nK:C\nA | c2 d e3/2 f/2 e | d2 B G3/2 A/2 B | c2 A A3/2 ^G/2 A |" },
  cabesa: { title: "Por una Cabeza", abc: "X:1\nT:Por una Cabeza\nM:4/4\nL:1/8\nQ:1/4=112\nK:C\ne/2e/2e/2e/2 e2 | d/2d/2d/2d/2 d2 | c/2c/2c/2c/2 c B/2c/2 | d B G2 |" },
  menuet: { title: "Menuet in G (transposed)", abc: "X:1\nT:Menuet in G\nM:3/4\nL:1/4\nQ:1/4=104\nK:C\nG c/2d/2 e/2f/2 | g c c | a f/2g/2 a/2b/2 | c' c c |" },
};

const BASE: Record<string, number> = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };

export function parseAbc(raw: string, id = "custom"): Melody {
  if (/^V:/m.test(raw) || /\[[A-Ga-g][^\]]*[A-Ga-g]/.test(raw)) throw new Error("Polyphonic ABC is not supported; provide one monodic voice.");
  const title = raw.match(/^T:(.*)$/m)?.[1]?.trim() || "Untitled melody";
  const meterText = raw.match(/^M:(\d+)\/(\d+)/m);
  const meter = { numerator: Number(meterText?.[1] ?? 4), denominator: Number(meterText?.[2] ?? 4) };
  const tempoQpm = Number(raw.match(/^Q:.*=(\d+)/m)?.[1] ?? 100);
  const length = raw.match(/^L:1\/(\d+)/m);
  const unitBeats = 4 / Number(length?.[1] ?? 4);
  const bodyOffset = raw.search(/^K:.*$/m);
  const body = bodyOffset >= 0 ? raw.slice(raw.indexOf("\n", bodyOffset) + 1) : raw;
  const token = /([_=^]?)([A-Ga-g])([,']*)(\d+(?:\/\d+)?|\/\d+|\/)?|z(\d+(?:\/\d+)?|\/\d+|\/)?|\|/g;
  const events: MelodyEvent[] = [];
  let beat = 0, measureIndex = 0, match: RegExpExecArray | null;
  const duration = (value?: string): number => {
    if (!value) return unitBeats;
    if (value === "/") return unitBeats / 2;
    if (value.startsWith("/")) return unitBeats / Number(value.slice(1));
    if (value.includes("/")) { const [a = "1", b = "1"] = value.split("/"); return unitBeats * Number(a) / Number(b); }
    return unitBeats * Number(value);
  };
  while ((match = token.exec(body))) {
    if (match[0] === "|") { measureIndex++; continue; }
    const isRest = match[0].startsWith("z");
    const value = isRest ? match[5] : match[4];
    const eventDuration = duration(value);
    let midi: number | undefined;
    if (!isRest) {
      const letter = match[2] ?? "C";
      midi = BASE[letter.toUpperCase()]! + (letter === letter.toLowerCase() ? 12 : 0);
      for (const mark of match[3] ?? "") midi += mark === "'" ? 12 : -12;
      midi += match[1] === "^" ? 1 : match[1] === "_" ? -1 : 0;
    }
    events.push({ id: `e${events.length}`, kind: isRest ? "rest" : "note", startBeat: beat, durationBeats: eventDuration, midi, measureIndex, sourceRange: { start: match.index, end: token.lastIndex } });
    beat += eventDuration;
  }
  if (!events.some((event) => event.kind === "note")) throw new Error("No notes found in ABC input.");
  return { id, title, tempoQpm, meter, events, source: { type: id === "custom" ? "abc" : "legacy", raw } };
}
