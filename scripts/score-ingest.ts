import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { importScore, stableStringify, toAbc, toMidi, toMusicXml } from "../src/score-import/core";
const args=process.argv.slice(2),input=args.find(x=>!x.startsWith("--")),oi=args.indexOf("--output"),output=oi>=0?args[oi+1]:"score-import-output";
if(!input)throw new Error("Usage: bun run score:ingest -- <input> --output <directory>");
const bytes=new Uint8Array(await Bun.file(input).arrayBuffer()),project=await importScore(bytes,basename(input)),candidate=project.candidates.find(c=>c.id===project.selectedCandidateId)??project.candidates[0];if(!candidate)throw new Error("No candidate produced");
await mkdir(output!,{recursive:true});const stem=basename(input,extname(input)).replace(/[^a-z0-9_-]/gi,"-");await Promise.all([writeFile(join(output!,`${stem}.json`),stableStringify(project)+"\n"),writeFile(join(output!,`${stem}.abc`),toAbc(candidate)),writeFile(join(output!,`${stem}.mid`),toMidi(candidate)),writeFile(join(output!,`${stem}.musicxml`),toMusicXml(candidate))]);
console.log(`Imported ${project.provenance.sourceType}: ${candidate.metrics.noteCount} notes → ${output}`);
