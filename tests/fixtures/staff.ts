export interface StaffFixture {
  id: string;
  label: string;
  summary: string;
  checks: string[];
  abc: string;
}

export const STAFF_FIXTURES: readonly StaffFixture[] = [
  {
    id: "accidentals-ties",
    label: "4/4 · accidentals, ties & ledger notes",
    summary: "A long G-major stress test with an anacrusis, explicit chromatic spelling, rests, dotted values, ties, and both ledger-line extremes.",
    checks: ["G key signature", "sharp · flat · natural", "whole / half / quarter / eighth / dotted", "rests and beamed eighths", "ties inside and across a bar", "C4–C6 ledger notes", "pickup and line change"],
    abc: `X:1
T:Engraving stress test
C:Harmonica Trainer lab fixture
M:4/4
L:1/8
Q:1/4=92
K:G
D2 | G2 A2 B2 c2 | d4 B2 z2 | (3cde ^f2 =f2 _B2 | A3 B c2 d2 |
e2-e2 d4 | c4-c2 z2 | G8 | z4 D2 E2 |
F2 G2 A2 B2 | c3 d e2 ^e2 | =e4 _e2 d2 | c2 B2 A4 |
C,4 G,4 | C8- | C4 z2 C2 | c'8 |]`,
  },
  {
    id: "compound-meter",
    label: "6/8 · beams, dotted rhythm & pickup",
    summary: "Compound-meter phrasing exposes beaming, dotted rhythm, short rests, pickup handling, and a tie over the barline.",
    checks: ["6/8 meter", "one-eighth pickup", "beamed groups", "dotted quarter and dotted eighth", "eighth / quarter rests", "cross-bar tie"],
    abc: `X:2
T:Compound-time ribbon study
M:6/8
L:1/8
Q:3/8=78
K:F
C | FGA A2B | c3 z2 A | Bcd c2B | A3-A2 G |
F2G A2B | c3/2 d/2 e2 z | f2e d2c | B3 z3 |
A2G F2E | D2E F2G | A3-A2 G | F6 |]`,
  },
  {
    id: "greensleeves",
    label: "Built-in · Greensleeves excerpt",
    summary: "A production-library example verifies that the proposed boundary works with existing authored ABC, not only synthetic fixtures.",
    checks: ["built-in melody source", "6/8 phrasing", "short beamed values", "explicit G-sharp", "conventional line wrapping"],
    abc: `X:3
T:Greensleeves · extended lab excerpt
M:6/8
L:1/8
Q:3/8=80
K:C
A | c2 d e3/2 f/2 e | d2 B G3/2 A/2 B | c2 A A3/2 ^G/2 A |
B2 ^G E3/2 F/2 G | A2 F D3/2 E/2 F | G2 E E3/2 ^D/2 E |
F2 G A3/2 G/2 F | E3-E2 A | c2 d e3/2 f/2 e | d2 B G3 |]`,
  },
];

export function staffFixture(id: string): StaffFixture {
  return STAFF_FIXTURES.find((fixture) => fixture.id === id) ?? STAFF_FIXTURES[0]!;
}
