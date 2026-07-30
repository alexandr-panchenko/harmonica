import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";

const files=["c4","e4","g4","c5","e5","g5","c6","e6","g6","c7"].map((note)=>`public/audio/harmonica/${note}.wav`);
describe("bundled harmonica instrument",()=>{
  test("contains local decodable WAV zones under the release size budget",()=>{let bytes=0;for(const file of files){const data=readFileSync(file);expect(data.subarray(0,4).toString()).toBe("RIFF");expect(data.subarray(8,12).toString()).toBe("WAVE");bytes+=statSync(file).size}expect(bytes).toBeLessThan(10_000_000)});
  test("ships its CC0 source attribution",()=>expect(readFileSync("public/audio/harmonica/LICENSE.md","utf8")).toContain("CC0 1.0"));
});
