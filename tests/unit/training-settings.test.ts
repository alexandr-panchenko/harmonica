import { describe, expect, test } from "bun:test";
import { createRandomSequence, findPitchPool, nextRandomPitch } from "../../src/exercises/findGenerator";
import { STANDARD_C10, STANDARD_C12 } from "../../src/harmonica/profile";
import { teachingNoteName } from "../../src/music/naming";

describe("find-note generation", () => {
  test("honors profile, range, and accidental constraints", () => {
    expect(findPitchPool(STANDARD_C12,"beginner","naturals")).toEqual([60,62,64,65,67,69,71,72]);
    expect(findPitchPool(STANDARD_C10,"full","chromatic").at(-1)).toBe(92);
    expect(findPitchPool(STANDARD_C12,"medium","chromatic").every((midi)=>midi<=84)).toBeTrue();
  });
  test("avoids repeats and obvious scale runs", () => {
    const pool=[60,62,64,65,67,69,71,72];
    const sequence=createRandomSequence(pool,12,()=>0);
    expect(sequence.every((midi,index)=>index===0||midi!==sequence[index-1])).toBeTrue();
    expect(nextRandomPitch(pool,[60],()=>0)).not.toBe(62);
  });
});

describe("teaching names", () => {
  test("switches visible aids between letters and consistent Si solfege", () => {
    expect(teachingNoteName(60,"letters")).toBe("C4");
    expect(teachingNoteName(61,"solfege")).toBe("Do♯4");
    expect(teachingNoteName(71,"solfege",false)).toBe("Si");
  });
});
