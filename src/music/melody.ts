export interface WrittenPitch { step: "C" | "D" | "E" | "F" | "G" | "A" | "B"; accidental?: "sharp" | "flat" | "natural"; octave: number }
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
  pinkPanther: {
    title: "The Pink Panther Theme",
    abc: `X:9
T:The Pink Panther Theme
C:Henry Mancini
M:4/4
L:1/16
Q:1/4=120
K:C
^D | E2 z4 z ^F G2 z4 z ^D | E3/2 z3/2 ^F G3/2 z3/2 c B3/2 z3/2 E G3/2 z3/2 B |
(3^A14 =A2 G2 (3E2 D2 E2- | E8 z7 ^D | E2 z4 z ^F G2 z4 z ^D |
E3/2 z3/2 ^F G3/2 z3/2 c B3/2 z3/2 G B3/2 z3/2 e | ^d16- | ^d12 z3 ^D |
E2 z4 z ^F G2 z4 z ^D | E3/2 z3/2 ^F G3/2 z3/2 c B3/2 z3/2 E G3/2 z3/2 B |
(3^A14 =A2 G2 (3E2 D2 E2- | E8 z8 | z4 e3 d B3 A G3 E |
^A =A3 ^A =A3 ^A =A3 ^A =A3 | (3G2 E2 D2 E12- | E8 z7 ^d |
e2 z4 z ^f g2 z4 z ^d | e3/2 z3/2 ^f g3/2 z3/2 c' b3/2 z3/2 e g3/2 z3/2 b |
(3^a14 =a2 g2 (3e2 d2 e2- | e8 z7 ^d | e2 z4 z ^f g2 z4 z ^d |
e3/2 z3/2 ^f g3/2 z3/2 c' b3/2 z3/2 g b3/2 z3/2 e' | ^d'16- | ^d'12 z3 ^d |
e2 z4 z ^f g2 z4 z ^d | e3/2 z3/2 ^f g3/2 z3/2 c' b3/2 z3/2 e g3/2 z3/2 b |
(3^a14 =a2 g2 (3e2 d2 e2- | e8 z8 | z4 e'3 d' b3 a g3 e |
^a =a3 ^a =a3 ^a =a3 ^a =a3 | (3g2 e2 d2 e2 e8- e2 | (3g2 e2 d2 e2 e8- e2 |
(3g2 e2 d2 e2 e8- e2 |`,
  },
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
  const token = /\((\d+)(?::(\d+))?(?::(\d+))?|([_=^]?)([A-Ga-g])([,']*)(\d+(?:\/\d+)?|\/\d+|\/)?(-)?|z(\d+(?:\/\d+)?|\/\d+|\/)?|\|/g;
  const events: MelodyEvent[] = [];
  let beat = 0, measureIndex = 0, match: RegExpExecArray | null, tieFromPrevious = false, tupletRemaining = 0, tupletFactor = 1;
  const duration = (value?: string): number => {
    if (!value) return unitBeats;
    if (value === "/") return unitBeats / 2;
    if (value.startsWith("/")) return unitBeats / Number(value.slice(1));
    if (value.includes("/")) { const [a = "1", b = "1"] = value.split("/"); return unitBeats * Number(a) / Number(b); }
    return unitBeats * Number(value);
  };
  while ((match = token.exec(body))) {
    if (match[1]) {
      const count = Number(match[1]), inTimeOf = Number(match[2] ?? (count === 2 || count === 4 || count === 8 ? 3 : 2));
      tupletRemaining = Number(match[3] ?? count);
      tupletFactor = inTimeOf / count;
      continue;
    }
    if (match[0] === "|") { measureIndex++; continue; }
    const isRest = match[0].startsWith("z");
    const value = isRest ? match[9] : match[7];
    const eventDuration = duration(value) * (tupletRemaining > 0 ? tupletFactor : 1);
    let midi: number | undefined, writtenPitch: WrittenPitch | undefined, tie: MelodyEvent["tie"];
    if (!isRest) {
      const letter = match[5] ?? "C";
      midi = BASE[letter.toUpperCase()]! + (letter === letter.toLowerCase() ? 12 : 0);
      for (const mark of match[6] ?? "") midi += mark === "'" ? 12 : -12;
      midi += match[4] === "^" ? 1 : match[4] === "_" ? -1 : 0;
      writtenPitch = {
        step: letter.toUpperCase() as WrittenPitch["step"],
        octave: Math.floor((midi - (match[4] === "^" ? 1 : match[4] === "_" ? -1 : 0)) / 12) - 1,
        accidental: match[4] === "^" ? "sharp" : match[4] === "_" ? "flat" : match[4] === "=" ? "natural" : undefined,
      };
      const tiesToNext = Boolean(match[8]);
      tie = tieFromPrevious ? (tiesToNext ? "continue" : "end") : tiesToNext ? "start" : undefined;
      tieFromPrevious = tiesToNext;
    }
    events.push({ id: `e${events.length}`, kind: isRest ? "rest" : "note", startBeat: beat, durationBeats: eventDuration, midi, writtenPitch, tie, measureIndex, sourceRange: { start: match.index, end: token.lastIndex } });
    beat += eventDuration;
    if (tupletRemaining > 0) { tupletRemaining--; if (tupletRemaining === 0) tupletFactor = 1; }
  }
  if (!events.some((event) => event.kind === "note")) throw new Error("No notes found in ABC input.");
  return { id, title, tempoQpm, meter, events, source: { type: id === "custom" ? "abc" : "legacy", raw } };
}
