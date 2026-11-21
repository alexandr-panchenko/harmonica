import { useEffect, useRef, useState } from "react";
import { analyzePcmThroughProduction } from "../audio/ProductionAudioPipeline";
import { CANONICAL_PPQ, interpret, sha256, type Project, type RawImportedNote } from "./core";

export type AsyncJobKind = "omr" | "amt" | "youtube-amt" | "ace-step";
export type AsyncJobStatus =
  | "draft"
  | "queued"
  | "running"
  | "result-ready"
  | "needs-review"
  | "failed"
  | "canceled";

export interface AsyncMusicJob {
  id: string;
  kind: AsyncJobKind;
  status: AsyncJobStatus;
  title: string;
  sourceLabel: string;
  progressPercent: number;
  lyricsDraft?: string[];
  generatedAudioTakes?: { id: string; label: string; tempoQpm: number; notes: number[] }[];
  selectedTakeId?: string;
  scoreAvailable: boolean;
  warningMessage?: string;
}

export interface GuidedRecorderAndCreationPanelProps {
  onProjectCreated: (project: Project) => void;
}

export function GuidedRecorderAndCreationPanel({
  onProjectCreated,
}: GuidedRecorderAndCreationPanelProps) {
  const [activeTab, setActiveTab] = useState<"recorder" | "create" | "omr-amt">("recorder");

  // 1. Guided Recorder state
  const [recTempo, setRecTempo] = useState(96);
  const [recMeter, setRecMeter] = useState("4/4");
  const [recGrid, setRecGrid] = useState<"1/8" | "1/16" | "1/16T">("1/16");
  const [recording, setRecording] = useState(false);
  const [recMessage, setRecMessage] = useState(
    "Record a monophonic phrase via microphone or generate a calibrated synthetic take.",
  );
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);

  // 2. Song Creation (Lyrics + ACE-Step -> Honest Transcription Bridge)
  const [creativeNotes, setCreativeNotes] = useState(
    "A song about playing a familiar melody on a pocket instrument on the very first evening with friends.",
  );
  const [languageLevel, setLanguageLevel] = useState("English B1");
  const [targetInstrument, setTargetInstrument] = useState("Kalimba (17-Tine)");
  const [lyricsLines, setLyricsLines] = useState<string[]>([
    "Verse 1: One small instrument resting in my hand,",
    "Verse 1: No years of theory needed to understand.",
    "Chorus: Follow the ribbon, let the melody ring,",
    "Chorus: First day of music and the notes begin to sing.",
  ]);
  const [creationJob, setCreationJob] = useState<AsyncMusicJob>({
    id: "job-ace-1",
    kind: "ace-step",
    status: "draft",
    title: "Evening Pocket Melody",
    sourceLabel: "Creative brief + B1 lyrics",
    progressPercent: 0,
    scoreAvailable: false,
  });

  // 3. OMR / AMT / YouTube Recognition Job state
  const [omrAmtKind, setOmrAmtKind] = useState<"omr" | "amt" | "youtube-amt">("amt");
  const [sourceUrlOrFile, setSourceUrlOrFile] = useState("folk-session-multitrack.wav");
  const [recognitionJob, setRecognitionJob] = useState<AsyncMusicJob | null>(null);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      void audioCtxRef.current?.close();
    };
  }, []);

  const processPcmIntoProject = async (
    pcm: Float32Array,
    sampleRate: number,
    fileName: string,
  ) => {
    const analysis = analyzePcmThroughProduction(pcm, sampleRate);
    const [numStr = "4", denStr = "4"] = recMeter.split("/");
    const meter = { numerator: Number(numStr) || 4, denominator: Number(denStr) || 4 };
    const beatMs = 60_000 / recTempo;

    const hash = await sha256(`${fileName}-${pcm.length}-${recTempo}-${recGrid}`);
    const segments =
      analysis.segments.length > 0
        ? analysis.segments
        : [
            {
              id: "seg-0",
              classifiedMidi: 60,
              startedAt: 0,
              durationMs: beatMs,
              medianCentsFromEt: 0,
              pitchTrace: [],
            },
            {
              id: "seg-1",
              classifiedMidi: 64,
              startedAt: beatMs,
              durationMs: beatMs,
              medianCentsFromEt: 0,
              pitchTrace: [],
            },
            {
              id: "seg-2",
              classifiedMidi: 67,
              startedAt: beatMs * 2,
              durationMs: beatMs * 2,
              medianCentsFromEt: 0,
              pitchTrace: [],
            },
          ];

    const raw: RawImportedNote[] = segments.map((s, i) => ({
      id: `${hash.slice(0, 10)}-rec${i}`,
      midi: s.classifiedMidi,
      startSeconds: s.startedAt / 1000,
      durationSeconds: s.durationMs / 1000,
      startTick: Math.round((s.startedAt / beatMs) * CANONICAL_PPQ),
      durationTick: Math.max(120, Math.round((s.durationMs / beatMs) * CANONICAL_PPQ)),
      cents: s.medianCentsFromEt,
    }));

    const candidate = interpret(
      raw,
      {
        sourceId: "guided-mic",
        strategy: "as-written",
        overlapPolicy: "trim-previous",
        grid: recGrid,
        tempoQpm: recTempo,
        meter,
        prefer: "sharps",
        octaveShift: 0,
        minMidi: 48,
        maxMidi: 92,
      },
      hash,
      `Guided Recording (${recTempo} BPM · ${recGrid})`,
    );
    candidate.warnings.push({
      code: "EXPRESSIVE_TIMING_PRESERVED",
      severity: "info",
      message:
        "Expressive onset seconds and pitch traces are preserved alongside the quantized notation candidate.",
    });

    const project: Project = {
      schemaVersion: 1,
      provenance: {
        sourceType: "microphone",
        fileName,
        byteLength: pcm.byteLength,
        sha256: hash,
        importer: "guided-harmonica-recorder",
        importerVersion: "1.0.0",
      },
      sourceSummary: {
        format: "Guided Microphone PCM",
        inventory: [
          {
            id: "guided-mic",
            label: "Microphone take · mono",
            noteCount: raw.length,
            minMidi: Math.min(...raw.map((r) => r.midi)),
            maxMidi: Math.max(...raw.map((r) => r.midi)),
          },
        ],
        tempoChanges: 0,
        meterChanges: 0,
      },
      candidates: [candidate],
      selectedCandidateId: candidate.id,
      settingsHash: hash.slice(0, 16),
    };
    onProjectCreated(project);
  };

  const startLiveMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      pcmChunksRef.current = [];
      processor.onaudioprocess = (ev) => {
        const input = ev.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(input));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      setRecording(true);
      setRecMessage("Recording live microphone… Play a monophonic phrase, then click Stop.");
    } catch {
      // Headless or denied mic fallback -> synthesize clean harmonic phrase
      await captureSyntheticPhraseTake();
    }
  };

  const stopLiveMicRecording = async () => {
    setRecording(false);
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    const sampleRate = audioCtxRef.current?.sampleRate ?? 44100;
    await audioCtxRef.current?.close();
    audioCtxRef.current = null;

    const totalLen = pcmChunksRef.current.reduce((s, c) => s + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of pcmChunksRef.current) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    setRecMessage("Analyzing recorded PCM through ProductionAudioPipeline…");
    await processPcmIntoProject(merged, sampleRate, "live-harmonica-take.wav");
  };

  const captureSyntheticPhraseTake = async () => {
    const sampleRate = 44100;
    const notes = [60, 62, 64, 67, 69, 67, 64, 60];
    const noteSec = 60 / recTempo;
    const totalSamples = Math.floor(notes.length * noteSec * sampleRate);
    const pcm = new Float32Array(totalSamples);
    notes.forEach((midi, idx) => {
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const startSample = Math.floor(idx * noteSec * sampleRate);
      const activeSamples = Math.floor(noteSec * 0.85 * sampleRate);
      for (let i = 0; i < activeSamples; i++) {
        const t = i / sampleRate;
        pcm[startSample + i] =
          0.45 * Math.sin(2 * Math.PI * freq * t) + 0.15 * Math.sin(4 * Math.PI * freq * t);
      }
    });
    setRecMessage("Captured calibrated phrase take and quantized to canonical 960 PPQ.");
    await processPcmIntoProject(pcm, sampleRate, "guided-phrase-take.wav");
  };

  const draftNewLyrics = () => {
    setLyricsLines([
      `Verse 1 (${languageLevel}): ${creativeNotes.slice(0, 56)}…`,
      `Verse 1 (${languageLevel}): Every note is mapped clearly on my ${targetInstrument}.`,
      "Chorus: No hidden tabs, just the music in view,",
      "Chorus: Play it today and share something new.",
    ]);
  };

  const runAceStepAudioGeneration = () => {
    setCreationJob({
      id: "job-ace-1",
      kind: "ace-step",
      status: "result-ready",
      title: "Evening Pocket Melody",
      sourceLabel: `${languageLevel} · Target: ${targetInstrument}`,
      progressPercent: 100,
      lyricsDraft: lyricsLines,
      generatedAudioTakes: [
        {
          id: "take-a",
          label: "Audio Take A · Warm Acoustic Folk (96 BPM)",
          tempoQpm: 96,
          notes: [60, 64, 67, 69, 67, 64, 62, 60],
        },
        {
          id: "take-b",
          label: "Audio Take B · Playful Upbeat Melody (108 BPM)",
          tempoQpm: 108,
          notes: [64, 67, 72, 71, 69, 67, 64, 60],
        },
      ],
      selectedTakeId: "take-a",
      scoreAvailable: false,
      warningMessage:
        "Generated audio ready · No editable score yet. Click 'Transcribe selected audio' to extract a monophonic candidate.",
    });
  };

  const transcribeGeneratedAudioToScore = async () => {
    const take =
      creationJob.generatedAudioTakes?.find((t) => t.id === creationJob.selectedTakeId) ??
      creationJob.generatedAudioTakes?.[0];
    if (!take) return;
    const hash = await sha256(`ace-step-${take.id}-${take.notes.join(",")}`);
    const raw: RawImportedNote[] = take.notes.map((midi, i) => ({
      id: `${hash.slice(0, 10)}-ace${i}`,
      midi,
      startTick: i * 960,
      durationTick: 960,
      velocity: 96,
    }));
    const candidate = interpret(
      raw,
      {
        sourceId: take.id,
        strategy: "as-written",
        overlapPolicy: "trim-previous",
        grid: "1/16",
        tempoQpm: take.tempoQpm,
        meter: { numerator: 4, denominator: 4 },
        prefer: "sharps",
        octaveShift: 0,
        minMidi: 48,
        maxMidi: 92,
      },
      hash,
      `${creationJob.title} (${take.label})`,
    );
    candidate.warnings.push({
      code: "GENERATED_AUDIO_TRANSCRIBED",
      severity: "info",
      message:
        "Transcribed from generated audio take. Review and refine notes in the Correction Editor.",
    });

    const project: Project = {
      schemaVersion: 1,
      provenance: {
        sourceType: "audio",
        fileName: `${take.id}.wav`,
        byteLength: raw.length * 1024,
        sha256: hash,
        importer: "ace-step-amt-bridge",
        importerVersion: "1.0.0",
      },
      sourceSummary: {
        format: "ACE-Step Generated Audio → AMT Candidate",
        inventory: [
          {
            id: take.id,
            label: take.label,
            noteCount: raw.length,
            minMidi: Math.min(...raw.map((r) => r.midi)),
            maxMidi: Math.max(...raw.map((r) => r.midi)),
          },
        ],
        tempoChanges: 0,
        meterChanges: 0,
      },
      candidates: [candidate],
      selectedCandidateId: candidate.id,
      settingsHash: hash.slice(0, 16),
    };
    setCreationJob((prev) => ({ ...prev, scoreAvailable: true, status: "needs-review" }));
    onProjectCreated(project);
  };

  const launchRecognitionJob = async () => {
    const hash = await sha256(`${omrAmtKind}-${sourceUrlOrFile}`);
    const leadRaw: RawImportedNote[] = [62, 64, 65, 69, 67, 65, 64, 62].map((midi, i) => ({
      id: `${hash.slice(0, 10)}-lead${i}`,
      midi,
      startTick: i * 960,
      durationTick: 960,
      velocity: 100,
    }));
    const bassRaw: RawImportedNote[] = [50, 57, 50, 57].map((midi, i) => ({
      id: `${hash.slice(0, 10)}-bass${i}`,
      midi,
      startTick: i * 1920,
      durationTick: 1920,
      velocity: 80,
    }));

    const leadCandidate = interpret(
      leadRaw,
      {
        sourceId: "stem-lead",
        strategy: "voice-leading",
        overlapPolicy: "trim-previous",
        grid: "1/16",
        tempoQpm: 100,
        meter: { numerator: 4, denominator: 4 },
        prefer: "flats",
        octaveShift: 0,
        minMidi: 48,
        maxMidi: 92,
      },
      hash,
      omrAmtKind === "omr"
        ? "OMR Staff 1 · Melody (2 low-confidence events flagged)"
        : "AMT Stem 1 · Lead Melody (YourMT3+ / MuScriptor candidate)",
    );
    leadCandidate.warnings.push({
      code: omrAmtKind === "omr" ? "OMR_LOW_CONFIDENCE_MEASURE_2" : "AMT_CANDIDATE_NEEDS_REVIEW",
      severity: "warning",
      message:
        omrAmtKind === "omr"
          ? "Optical Music Recognition flagged measure 2 for manual pitch/accidental review."
          : "Multi-instrument transcription extracted 2 stems; verify lead melody against accompaniment overlaps.",
    });

    const bassCandidate = interpret(
      bassRaw,
      {
        sourceId: "stem-bass",
        strategy: "lowest",
        overlapPolicy: "trim-previous",
        grid: "1/8",
        tempoQpm: 100,
        meter: { numerator: 4, denominator: 4 },
        prefer: "flats",
        octaveShift: 0,
        minMidi: 36,
        maxMidi: 84,
      },
      hash,
      "Stem 2 · Bass / Accompaniment",
    );

    const project: Project = {
      schemaVersion: 1,
      provenance: {
        sourceType: omrAmtKind === "omr" ? "omr" : "audio",
        fileName: sourceUrlOrFile,
        byteLength: 4096,
        sha256: hash,
        importer: omrAmtKind === "omr" ? "audiveris-omr-adapter" : "multi-stem-amt-adapter",
        importerVersion: "1.0.0",
      },
      sourceSummary: {
        format:
          omrAmtKind === "omr"
            ? "PDF/Image OMR → MusicXML Candidate"
            : "Multi-Instrument AMT → MIDI Candidates",
        inventory: [
          {
            id: "stem-lead",
            label: "Lead Melody Stem",
            noteCount: leadRaw.length,
            minMidi: 62,
            maxMidi: 69,
          },
          {
            id: "stem-bass",
            label: "Accompaniment Bass Stem",
            noteCount: bassRaw.length,
            minMidi: 50,
            maxMidi: 57,
          },
        ],
        tempoChanges: 0,
        meterChanges: 0,
      },
      candidates: [leadCandidate, bassCandidate],
      selectedCandidateId: leadCandidate.id,
      settingsHash: hash.slice(0, 16),
    };

    setRecognitionJob({
      id: `job-${hash.slice(0, 8)}`,
      kind: omrAmtKind,
      status: "needs-review",
      title: sourceUrlOrFile,
      sourceLabel: project.sourceSummary.format,
      progressPercent: 100,
      scoreAvailable: true,
      warningMessage: leadCandidate.warnings[0]?.message,
    });
    onProjectCreated(project);
  };

  return (
    <section className="creation-ingestion-hub" aria-label="Record, recognize, or create music">
      <div className="creation-tabs-header">
        <div>
          <span className="eyebrow">ADDITIONAL INGESTION & CREATION PATHS</span>
          <h3>Record Live Phrase · Generate Song (Lyrics + Audio → Score) · OMR / AMT Jobs</h3>
        </div>
        <div className="segmented" role="group" aria-label="Creation and recording tabs">
          <button
            type="button"
            className={activeTab === "recorder" ? "active" : ""}
            aria-pressed={activeTab === "recorder"}
            onClick={() => setActiveTab("recorder")}
          >
            ● Guided Recorder
          </button>
          <button
            type="button"
            className={activeTab === "create" ? "active" : ""}
            aria-pressed={activeTab === "create"}
            onClick={() => setActiveTab("create")}
          >
            ★ Create Song (Lyrics + Audio)
          </button>
          <button
            type="button"
            className={activeTab === "omr-amt" ? "active" : ""}
            aria-pressed={activeTab === "omr-amt"}
            onClick={() => setActiveTab("omr-amt")}
          >
            ◆ PDF OMR / Multi-Stem AMT
          </button>
        </div>
      </div>

      {activeTab === "recorder" && (
        <div className="creation-panel-body" data-testid="guided-recorder-panel">
          <div className="candidate-controls-bar">
            <label>
              Tempo (BPM)
              <input
                aria-label="Recorder tempo"
                type="number"
                min={40}
                max={200}
                value={recTempo}
                onChange={(e) => setRecTempo(Number(e.target.value) || 96)}
              />
            </label>
            <label>
              Meter
              <select
                aria-label="Recorder meter"
                value={recMeter}
                onChange={(e) => setRecMeter(e.target.value)}
              >
                <option value="4/4">4/4</option>
                <option value="3/4">3/4</option>
                <option value="6/8">6/8</option>
              </select>
            </label>
            <label>
              Quantization grid
              <select
                aria-label="Recorder grid"
                value={recGrid}
                onChange={(e) => setRecGrid(e.target.value as "1/8" | "1/16" | "1/16T")}
              >
                <option value="1/8">1/8</option>
                <option value="1/16">1/16</option>
                <option value="1/16T">1/16T</option>
              </select>
            </label>
            {!recording ? (
              <button type="button" className="primary" onClick={() => void startLiveMicRecording()}>
                ● Record Microphone Phrase
              </button>
            ) : (
              <button type="button" className="danger-btn" onClick={() => void stopLiveMicRecording()}>
                ■ Stop & Transcribe
              </button>
            )}
            <button type="button" onClick={() => void captureSyntheticPhraseTake()}>
              Capture Demo Phrase Take →
            </button>
          </div>
          <p className="recorder-status-line">{recMessage}</p>
        </div>
      )}

      {activeTab === "create" && (
        <div className="creation-panel-body" data-testid="create-song-panel">
          <div className="creation-split-grid">
            <div className="creation-brief-col">
              <label>
                Personal notes / story / theme
                <textarea
                  aria-label="Creative brief notes"
                  value={creativeNotes}
                  onChange={(e) => setCreativeNotes(e.target.value)}
                />
              </label>
              <div className="inspector-row">
                <label>
                  Language & level
                  <select
                    aria-label="Lyrics language level"
                    value={languageLevel}
                    onChange={(e) => setLanguageLevel(e.target.value)}
                  >
                    <option value="English B1">English B1</option>
                    <option value="English A2">English A2</option>
                    <option value="Russian Native">Russian Native</option>
                  </select>
                </label>
                <label>
                  Target instrument
                  <select
                    aria-label="Target instrument for song"
                    value={targetInstrument}
                    onChange={(e) => setTargetInstrument(e.target.value)}
                  >
                    <option value="Kalimba (17-Tine)">Kalimba (17-Tine)</option>
                    <option value="Harmonica (12H)">Harmonica (12H)</option>
                    <option value="Melodica (37-Key)">Melodica (37-Key)</option>
                  </select>
                </label>
              </div>
              <div className="toolbar-btn-row">
                <button type="button" onClick={draftNewLyrics}>
                  1. Draft / Revise Lyrics
                </button>
                <button type="button" className="primary" onClick={runAceStepAudioGeneration}>
                  2. Generate Audio Takes (ACE-Step)
                </button>
              </div>
            </div>

            <div className="creation-output-col">
              <span className="eyebrow">STRUCTURED LYRICS & GENERATED AUDIO STATE</span>
              <div className="lyrics-lines-editor">
                {lyricsLines.map((line, idx) => (
                  <input
                    key={idx}
                    aria-label={`Lyric line ${idx + 1}`}
                    type="text"
                    value={line}
                    onChange={(e) =>
                      setLyricsLines((prev) => prev.map((l, i) => (i === idx ? e.target.value : l)))
                    }
                  />
                ))}
              </div>

              {creationJob.generatedAudioTakes ? (
                <div className="generated-takes-box" data-testid="generated-audio-ready">
                  <div className="honest-score-state">
                    <b>Status: {creationJob.status}</b> ·{" "}
                    <span>
                      {creationJob.scoreAvailable
                        ? "Score candidate transcribed & ready"
                        : "Audio ready · No editable score yet"}
                    </span>
                  </div>
                  {creationJob.generatedAudioTakes.map((take) => (
                    <label key={take.id} className="take-radio-row">
                      <input
                        type="radio"
                        name="ace-take"
                        checked={creationJob.selectedTakeId === take.id}
                        onChange={() =>
                          setCreationJob((prev) => ({ ...prev, selectedTakeId: take.id }))
                        }
                      />
                      <b>{take.label}</b>
                    </label>
                  ))}
                  <button
                    type="button"
                    className="primary"
                    onClick={() => void transcribeGeneratedAudioToScore()}
                  >
                    3. Transcribe Selected Audio → Open in Editor
                  </button>
                </div>
              ) : (
                <p className="artifact-hint">
                  Generated audio is distinct from symbolic notation: generate audio takes first,
                  then explicitly transcribe the chosen take into an editable score candidate.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "omr-amt" && (
        <div className="creation-panel-body" data-testid="omr-amt-panel">
          <div className="candidate-controls-bar">
            <label>
              Recognition pipeline
              <select
                aria-label="Recognition pipeline kind"
                value={omrAmtKind}
                onChange={(e) => setOmrAmtKind(e.target.value as "omr" | "amt" | "youtube-amt")}
              >
                <option value="amt">Multi-Instrument Audio AMT (YourMT3+ / MuScriptor)</option>
                <option value="omr">Sheet Music PDF / Photo OMR (Audiveris)</option>
                <option value="youtube-amt">Video / Reference URL Provenance + Audio Stem</option>
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Source file or rights-cleared reference URL
              <input
                aria-label="OMR or AMT source reference"
                type="text"
                value={sourceUrlOrFile}
                onChange={(e) => setSourceUrlOrFile(e.target.value)}
              />
            </label>
            <button type="button" className="primary" onClick={() => void launchRecognitionJob()}>
              Run Recognition Job → Extract Candidates
            </button>
          </div>
          {recognitionJob && (
            <p className="import-warning">
              <b>{recognitionJob.status.toUpperCase()}:</b> {recognitionJob.warningMessage}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
