import { useEffect, useMemo, useRef, useState } from "react";
import { trainerUrl } from "../app/url";
import { PlaybackEngine } from "../audio/PlaybackEngine";
import { InfiniteCanvasBoard } from "../canvas-workbench/InfiniteCanvasBoard";
import { CollabProjectDocument } from "../collab/portableInstrumentsSchema";
import { ThemeControl } from "../components/ThemeControl";
import { STANDARD_C12 } from "../harmonica/profile";
import { ImprovisationWorkspace } from "../improvisation/ImprovisationWorkspace";
import type { PortableInstrumentId } from "../instruments/instrumentProfiles";
import { adaptAbc } from "../notation/abc/AbcAdapter";
import { MusicStage } from "../notation/abc/AbcRenderer";
import {
  EditorCommandHistory,
  compareOriginalAndEdited,
  createEditableArrangementFromCandidate,
} from "../score-editor/EditableArrangement";
import { ScoreCorrectionEditor } from "../score-editor/ScoreCorrectionEditor";
import type { EditCommand, EditableArrangementProject } from "../score-editor/editorTypes";
import {
  editableArrangementToMelody,
  parseEditorProjectJson,
  serializeArrangementToAbc,
  serializeArrangementToMidi,
  serializeArrangementToMusicXml,
  serializeCanonicalArrangementJson,
  serializeEditorProjectJson,
} from "../score-editor/serialization";
import { analyzeHarmonicaRange, validateArrangement } from "../score-editor/validation";
import { GuidedRecorderAndCreationPanel } from "./GuidedRecorderAndCreationPanel";
import {
  importScore,
  interpret,
  stableStringify,
  toAbc,
  toMidi,
  toMusicXml,
  type Candidate,
  type Project,
  type Settings,
} from "./core";

export type WorkbenchStage = "import" | "extract" | "edit" | "canvas" | "improvise" | "export";

const player = new PlaybackEngine();

export function ScoreImportWorkbench() {
  const [stage, setStage] = useState<WorkbenchStage>("import");
  const [project, setProject] = useState<Project>();
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [editorProject, setEditorProject] = useState<EditableArrangementProject>();
  const historyRef = useRef<EditorCommandHistory | null>(null);
  const collabDocRef = useRef<CollabProjectDocument | null>(null);
  const [canvasInstrumentId, setCanvasInstrumentId] = useState<PortableInstrumentId>("harmonica-12-c");
  const [, setRevisionTick] = useState(0);
  const [profileId, setProfileId] = useState(
    () => localStorage.getItem("harmonica-profile") ?? STANDARD_C12.id,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidatePlaying, setCandidatePlaying] = useState(false);

  useEffect(() => () => player.stop(), []);

  const candidate = useMemo(
    () =>
      project?.candidates.find(
        (c) => c.id === (selectedCandidateId || project.selectedCandidateId),
      ) ?? project?.candidates[0],
    [project, selectedCandidateId],
  );

  const [canvasSelectedEventIds, setCanvasSelectedEventIds] = useState<string[]>([]);

  const syncCollabFromEditor = (nextEditor: EditableArrangementProject, lyricsLines?: readonly string[]) => {
    if (!collabDocRef.current) {
      collabDocRef.current = new CollabProjectDocument(nextEditor, canvasInstrumentId, lyricsLines);
    } else {
      collabDocRef.current.syncFromArrangement(nextEditor.arrangement, canvasInstrumentId);
    }
  };

  const loadImportedProject = (imported: Project, lyricsLines?: readonly string[], jumpToCanvas = false) => {
    setProject(imported);
    const firstCand = imported.candidates.find((c) => c.id === imported.selectedCandidateId) ?? imported.candidates[0];
    setSelectedCandidateId(firstCand?.id ?? "");
    if (firstCand) {
      const draft = createEditableArrangementFromCandidate(imported, firstCand.id);
      historyRef.current = new EditorCommandHistory(draft);
      setEditorProject(draft);
      setCanvasSelectedEventIds(draft.arrangement.events[0] ? [draft.arrangement.events[0].id] : []);
      collabDocRef.current = new CollabProjectDocument(draft, canvasInstrumentId, lyricsLines);
      setStage(jumpToCanvas ? "canvas" : "extract");
    } else {
      setEditorProject(undefined);
      historyRef.current = null;
      collabDocRef.current = null;
      setStage("extract");
    }
  };

  const loadFile = async (file: File) => {
    setBusy(true);
    setError("");
    player.stopReferencePlayback();
    setCandidatePlaying(false);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".json")) {
        const text = await file.text();
        const parsedEditor = parseEditorProjectJson(text);
        setProject(parsedEditor.sourceProject);
        setSelectedCandidateId(parsedEditor.sourceCandidateId);
        historyRef.current = new EditorCommandHistory(parsedEditor);
        setEditorProject(parsedEditor);
        syncCollabFromEditor(parsedEditor);
        setStage("edit");
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const imported = await importScore(bytes, file.name);
        setProject(imported);
        setSelectedCandidateId(imported.selectedCandidateId ?? imported.candidates[0]?.id ?? "");
        setEditorProject(undefined);
        historyRef.current = null;
        collabDocRef.current = null;
        setStage("extract");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateCandidateSettings = (patch: Partial<Settings>) => {
    if (!project || !candidate) return;
    const nextSettings: Settings = {
      ...candidate.settings,
      ...patch,
      meter: patch.meter ? { ...patch.meter } : { ...candidate.settings.meter },
    };
    const reinterpreted = interpret(
      candidate.rawNotes,
      nextSettings,
      project.provenance.sha256,
      candidate.label,
    );
    const updatedCandidates = project.candidates.map((c) =>
      c.id === candidate.id ? { ...reinterpreted, id: candidate.id, label: candidate.label } : c,
    );
    setProject({
      ...project,
      candidates: updatedCandidates,
    });
  };

  const startEditingCandidate = (targetCandidate?: Candidate, nextStage: "edit" | "canvas" = "edit") => {
    const chosen = targetCandidate ?? candidate;
    if (!project || !chosen) return;
    player.stopReferencePlayback();
    setCandidatePlaying(false);
    const draft = createEditableArrangementFromCandidate(project, chosen.id);
    historyRef.current = new EditorCommandHistory(draft);
    setEditorProject(draft);
    syncCollabFromEditor(draft);
    setStage(nextStage);
  };

  const executeCommand = (command: EditCommand) => {
    const hist = historyRef.current;
    if (!hist) return;
    try {
      setError("");
      const res = hist.execute(command);
      setEditorProject(res.project);
      syncCollabFromEditor(res.project);
      setRevisionTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUndo = () => {
    const hist = historyRef.current;
    if (!hist) return;
    const next = hist.undo();
    setEditorProject(next);
    syncCollabFromEditor(next);
    setRevisionTick((t) => t + 1);
  };

  const handleRedo = () => {
    const hist = historyRef.current;
    if (!hist) return;
    const next = hist.redo();
    setEditorProject(next);
    syncCollabFromEditor(next);
    setRevisionTick((t) => t + 1);
  };

  const handleResetToCandidate = () => {
    const hist = historyRef.current;
    if (!hist) return;
    const next = hist.resetToBase();
    setEditorProject(next);
    syncCollabFromEditor(next);
    setRevisionTick((t) => t + 1);
  };

  const handleCollabArrangementSync = (nextEditor: EditableArrangementProject) => {
    historyRef.current = new EditorCommandHistory(nextEditor);
    setEditorProject(nextEditor);
    setRevisionTick((t) => t + 1);
  };

  const auditionCandidate = async (c: Candidate) => {
    if (candidatePlaying) {
      player.stopReferencePlayback();
      setCandidatePlaying(false);
      return;
    }
    setCandidatePlaying(true);
    await player.startReferencePlayback(
      {
        id: c.id,
        title: c.label,
        events: c.canonicalEvents,
        tempoQpm: c.tempoQpm,
        meter: c.meter,
      },
      0,
    );
    setCandidatePlaying(false);
  };

  const downloadFile = (name: string, data: string | Uint8Array, type: string) => {
    const part: BlobPart = typeof data === "string" ? data : new Uint8Array(data);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([part], { type }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const openInSongPractice = (abc: string) => {
    player.stopReferencePlayback();
    sessionStorage.setItem("score-import-abc", abc);
    location.href = trainerUrl("?import=workbench");
  };

  const activeValidation = useMemo(
    () =>
      editorProject
        ? validateArrangement(editorProject.arrangement, profileId)
        : undefined,
    [editorProject, profileId],
  );
  const activeRange = useMemo(
    () =>
      editorProject
        ? analyzeHarmonicaRange(editorProject.arrangement, profileId)
        : undefined,
    [editorProject, profileId],
  );
  const activeDiff = useMemo(
    () =>
      editorProject && historyRef.current && activeRange
        ? compareOriginalAndEdited(
            historyRef.current.base,
            editorProject,
            activeRange.minMidi,
            activeRange.maxMidi,
          )
        : undefined,
    [editorProject, activeRange],
  );

  const editedAbc = useMemo(
    () => (editorProject ? serializeArrangementToAbc(editorProject.arrangement) : ""),
    [editorProject],
  );

  const fileStem = useMemo(() => {
    const raw =
      editorProject?.arrangement.title ??
      project?.provenance.fileName.replace(/\.[^.]+$/, "") ??
      "arrangement";
    return raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "arrangement";
  }, [editorProject?.arrangement.title, project?.provenance.fileName]);

  return (
    <div className="workbench-shell">
      <header className="workbench-topbar">
        <div className="workbench-brand-cluster">
          <a className="menu-exit workbench-back-link" href={trainerUrl()}>
            ← Back to Trainer
          </a>
          <div className="workbench-title-group">
            <span className="eyebrow">Local-first score tools</span>
            <h1>Score Import & Correction Workbench</h1>
          </div>
        </div>

        <nav className="workbench-stage-nav" aria-label="Workbench stages">
          <button
            type="button"
            className={stage === "import" ? "active" : ""}
            aria-current={stage === "import" ? "step" : undefined}
            onClick={() => setStage("import")}
          >
            1. Import
          </button>
          <button
            type="button"
            disabled={!project}
            className={stage === "extract" ? "active" : ""}
            aria-current={stage === "extract" ? "step" : undefined}
            onClick={() => project && setStage("extract")}
          >
            2. Extract
          </button>
          <button
            type="button"
            disabled={!project}
            className={stage === "edit" ? "active" : ""}
            aria-current={stage === "edit" ? "step" : undefined}
            onClick={() => {
              if (editorProject) setStage("edit");
              else if (candidate) startEditingCandidate(candidate, "edit");
            }}
          >
            3. Edit
          </button>
          <button
            type="button"
            disabled={!project}
            className={stage === "canvas" ? "active" : ""}
            aria-current={stage === "canvas" ? "step" : undefined}
            data-testid="workbench-stage-canvas-btn"
            onClick={() => {
              if (editorProject) {
                syncCollabFromEditor(editorProject);
                setStage("canvas");
              } else if (candidate) {
                startEditingCandidate(candidate, "canvas");
              }
            }}
          >
            4. Canvas 2D &amp; AI
          </button>
          <button
            type="button"
            className={stage === "improvise" ? "active" : ""}
            aria-current={stage === "improvise" ? "step" : undefined}
            data-testid="workbench-stage-improvise-btn"
            onClick={() => setStage("improvise")}
          >
            5. Scale &amp; Improvise
          </button>
          <button
            type="button"
            disabled={!project}
            className={stage === "export" ? "active" : ""}
            aria-current={stage === "export" ? "step" : undefined}
            onClick={() => {
              if (!editorProject && candidate) startEditingCandidate(candidate, "edit");
              setStage("export");
            }}
          >
            6. Export
          </button>
        </nav>

        <div className="workbench-header-tools">
          <ThemeControl />
        </div>
      </header>

      <main className="workbench-main">
        {error && (
          <p role="alert" className="import-error">
            {error}
          </p>
        )}

        {stage === "import" && (
          <section className="workbench-stage-panel import-stage" aria-label="Import stage">
            <div className="import-privacy-banner">
              <b>Private local processing:</b> MIDI, MusicXML/MXL, monophonic WAV, and{" "}
              <code>.harmonica-project.json</code> files are processed strictly on this device. No
              files or telemetry are ever uploaded.
            </div>

            <div className="import-drop">
              <label>
                <b>{busy ? "Processing file…" : "Choose or drop a score or saved editor project"}</b>
                <span>
                  Supported: .mid · .midi · .musicxml · .xml · .mxl · 16-bit PCM .wav ·
                  .harmonica-project.json
                </span>
                <input
                  aria-label="Import score or project file"
                  type="file"
                  accept=".mid,.midi,.musicxml,.xml,.mxl,.wav,.json"
                  onChange={(e) => e.target.files?.[0] && void loadFile(e.target.files[0])}
                />
              </label>
            </div>

            {project && (
              <div className="existing-import-bar">
                <span>
                  Loaded source: <b>{project.provenance.fileName}</b> ({project.sourceSummary.format} ·{" "}
                  {project.candidates.length} candidate(s))
                </span>
                <div className="toolbar-btn-row">
                  <button type="button" onClick={() => setStage("extract")}>
                    Inspect candidates →
                  </button>
                  {editorProject && (
                    <button type="button" className="primary" onClick={() => setStage("edit")}>
                      Resume editing arrangement →
                    </button>
                  )}
                  {editorProject && (
                    <button
                      type="button"
                      onClick={() => {
                        syncCollabFromEditor(editorProject);
                        setStage("canvas");
                      }}
                    >
                      Open 2D Canvas Board →
                    </button>
                  )}
                </div>
              </div>
            )}

            <GuidedRecorderAndCreationPanel
              onProjectCreated={(imported) => {
                loadImportedProject(imported, undefined, false);
              }}
            />
          </section>
        )}

        {stage === "extract" && project && (
          <section className="workbench-stage-panel extract-stage" aria-label="Extract stage">
            <div className="extract-header-bar">
              <div className="source-identity">
                <span className="eyebrow">Source inventory</span>
                <h2>{project.provenance.fileName}</h2>
                <p>
                  {project.sourceSummary.format} · {(project.provenance.byteLength / 1024).toFixed(1)} KB ·
                  SHA-256 <code>{project.provenance.sha256.slice(0, 16)}…</code>
                </p>
              </div>
              <div className="extract-primary-actions">
                <button type="button" onClick={() => setStage("import")}>
                  Import another file
                </button>
                {candidate && (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => startEditingCandidate(candidate)}
                  >
                    Edit this candidate →
                  </button>
                )}
              </div>
            </div>

            <div className="extract-workspace-grid">
              <aside className="extract-inventory-column" aria-label="Tracks and candidates">
                <span className="eyebrow">SOURCE LINES ({project.sourceSummary.inventory.length})</span>
                <div className="inventory-compact-list">
                  {project.sourceSummary.inventory.map((item) => (
                    <article key={item.id} className="inventory-row">
                      <b>{item.label}</b>
                      <span>
                        {item.noteCount} notes · MIDI {item.minMidi}–{item.maxMidi}
                      </span>
                    </article>
                  ))}
                </div>

                <label className="candidate-picker-label">
                  <b>Candidate / extraction strategy</b>
                  <select
                    aria-label="Candidate"
                    value={candidate?.id ?? ""}
                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                  >
                    {project.candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </aside>

              {candidate && (
                <div className="extract-preview-column">
                  <div className="candidate-controls-bar">
                    <label>
                      Grid
                      <select
                        aria-label="Quantization grid"
                        value={candidate.settings.grid}
                        onChange={(e) =>
                          updateCandidateSettings({
                            grid: e.target.value as Settings["grid"],
                          })
                        }
                      >
                        {(["off", "1/4", "1/8", "1/8T", "1/16", "1/16T", "1/32"] as const).map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Overlap policy
                      <select
                        aria-label="Overlap policy"
                        value={candidate.settings.overlapPolicy}
                        onChange={(e) =>
                          updateCandidateSettings({
                            overlapPolicy: e.target.value as Settings["overlapPolicy"],
                          })
                        }
                      >
                        <option value="trim-previous">Trim previous</option>
                        <option value="prefer-louder">Prefer louder</option>
                        <option value="prefer-longer">Prefer longer</option>
                        <option value="reject">Reject overlap</option>
                      </select>
                    </label>
                    <label>
                      Spelling
                      <select
                        aria-label="Candidate spelling preference"
                        value={candidate.settings.prefer}
                        onChange={(e) =>
                          updateCandidateSettings({
                            prefer: e.target.value as Settings["prefer"],
                          })
                        }
                      >
                        <option value="sharps">Sharps (♯)</option>
                        <option value="flats">Flats (♭)</option>
                      </select>
                    </label>
                    <label>
                      Octave shift
                      <select
                        aria-label="Candidate octave shift"
                        value={candidate.settings.octaveShift}
                        onChange={(e) =>
                          updateCandidateSettings({
                            octaveShift: Number(e.target.value),
                          })
                        }
                      >
                        {[-2, -1, 0, 1, 2].map((o) => (
                          <option key={o} value={o}>
                            {o > 0 ? `+${o}` : o}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="listen"
                      onClick={() => void auditionCandidate(candidate)}
                    >
                      {candidatePlaying ? "■ Stop audition" : "▶ Sampled harmonica"}
                    </button>
                  </div>

                  <div className="score-preview">
                    <MusicStage
                      document={adaptAbc(toAbc(candidate))}
                      mode="score"
                      activeBeat={0}
                      accessibleLabel="Imported score preview"
                      ribbons="none"
                    />
                  </div>

                  {candidate.warnings.length > 0 && (
                    <div className="candidate-warnings">
                      {candidate.warnings.map((w) => (
                        <p className="import-warning" key={w.code + w.message}>
                          <b>{w.code}</b> {w.message}
                        </p>
                      ))}
                    </div>
                  )}

                  <details className="secondary-diagnostics-drawer">
                    <summary>Raw vs quantized timing & candidate metrics</summary>
                    <div className="metric-grid">
                      {Object.entries(candidate.metrics).map(([k, v]) => (
                        <span key={k}>
                          {k}
                          <b>{Number.isFinite(v) ? Math.round(v * 100) / 100 : "—"}</b>
                        </span>
                      ))}
                    </div>
                    <div className="timing-list">
                      {candidate.rawNotes.slice(0, 24).map((n, i) => (
                        <span key={n.id}>
                          #{i + 1} MIDI {n.midi}: raw{" "}
                          {n.startTick ?? `${n.startSeconds?.toFixed(3)}s`} → grid{" "}
                          {candidate.canonicalEvents
                            .filter((e) => e.kind === "note")
                            [i]?.startBeat.toFixed(3) ?? "—"}{" "}
                          beats
                        </span>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          </section>
        )}

        {stage === "edit" && editorProject && historyRef.current && (
          <ScoreCorrectionEditor
            history={historyRef.current}
            project={editorProject}
            baseCandidate={candidate}
            player={player}
            profileId={profileId}
            onSelectProfile={setProfileId}
            onExecuteCommand={executeCommand}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onResetToCandidate={handleResetToCandidate}
            onOpenExportStage={() => setStage("export")}
            onOpenInSongPractice={() => openInSongPractice(editedAbc)}
          />
        )}

        {stage === "canvas" && editorProject && collabDocRef.current && (
          <InfiniteCanvasBoard
            collabDoc={collabDocRef.current}
            arrangement={editorProject.arrangement}
            selectedEventIds={
              canvasSelectedEventIds.length > 0
                ? canvasSelectedEventIds
                : editorProject.arrangement.events[0]
                  ? [editorProject.arrangement.events[0].id]
                  : []
            }
            onSelectEvent={(evId) => setCanvasSelectedEventIds([evId])}
            onDragPitchDiatonically={(evId, deltaSteps) => {
              executeCommand({
                type: "move-pitch-diatonically",
                eventId: evId,
                deltaSteps,
              });
            }}
            onSyncFromCollab={() => {
              if (!collabDocRef.current || !editorProject) return;
              const decoded = collabDocRef.current.getDecodedState();
              setCanvasInstrumentId(decoded.activeInstrument);
              handleCollabArrangementSync({
                ...editorProject,
                arrangement: decoded.arrangement,
              });
            }}
            onPlayAudition={() => {
              void player.playMelody(editableArrangementToMelody(editorProject.arrangement));
            }}
            onOpenInSongPractice={() => openInSongPractice(editedAbc)}
          />
        )}

        {stage === "improvise" && (
          <ImprovisationWorkspace
            defaultInstrumentId={canvasInstrumentId}
            onExportPhraseToWorkbench={(title, midis) => {
              const rawNotes = midis.map((midi, idx) => ({
                id: `improv_${idx + 1}`,
                midi,
                startTick: idx * 960,
                durationTick: 960,
                velocity: 96,
              }));
              const settings: Settings = {
                sourceId: "improv_line",
                strategy: "as-written",
                prefer: "sharps",
                grid: "1/4",
                tempoQpm: 108,
                meter: { numerator: 4, denominator: 4 },
                overlapPolicy: "trim-previous",
                octaveShift: 0,
                minMidi: 48,
                maxMidi: 84,
              };
              const cand = interpret(rawNotes, settings, "improvisation_phrase_sha256", title);
              const improvProject: Project = {
                schemaVersion: 1,
                provenance: {
                  sourceType: "midi",
                  fileName: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mid`,
                  sha256: "improvisation_phrase_sha256",
                  byteLength: midis.length * 16,
                  importer: "harmonica-improv-studio",
                  importerVersion: "1.0.0",
                },
                sourceSummary: {
                  format: "Improvised Phrase",
                  tempoChanges: 1,
                  meterChanges: 1,
                  inventory: [
                    {
                      id: "improv_line",
                      label: title,
                      noteCount: midis.length,
                      minMidi: Math.min(...midis),
                      maxMidi: Math.max(...midis),
                    },
                  ],
                },
                candidates: [cand],
                selectedCandidateId: cand.id,
                settingsHash: "improvisation_settings_hash",
              };
              loadImportedProject(improvProject, [title], false);
              setStage("edit");
            }}
          />
        )}

        {stage === "export" && project && (
          <section className="workbench-stage-panel export-stage" aria-label="Export stage">
            <div className="export-header-bar">
              <div>
                <span className="eyebrow">Review, validate & export</span>
                <h2>{editorProject?.arrangement.title ?? candidate?.label ?? "Arrangement"}</h2>
                <p>
                  Deterministic export of the{" "}
                  {editorProject ? "edited monophonic arrangement" : "selected candidate"}.
                </p>
              </div>
              <div className="toolbar-btn-row">
                {editorProject && (
                  <button type="button" onClick={() => setStage("edit")}>
                    ← Back to Editor
                  </button>
                )}
                <button
                  type="button"
                  className="primary"
                  disabled={Boolean(activeValidation && !activeValidation.valid)}
                  onClick={() =>
                    openInSongPractice(
                      editorProject ? editedAbc : candidate ? toAbc(candidate) : "",
                    )
                  }
                >
                  Open in Song Practice →
                </button>
              </div>
            </div>

            {editorProject && activeDiff && activeValidation && (
              <div className="export-summary-cards">
                <div className="export-card">
                  <span className="eyebrow">ORIGINAL VS EDITED DIFF</span>
                  <div className="inspector-kv-grid">
                    <span>
                      Pitches changed <b>{activeDiff.pitchesChanged}</b>
                    </span>
                    <span>
                      Spellings changed <b>{activeDiff.spellingsChanged}</b>
                    </span>
                    <span>
                      Durations changed <b>{activeDiff.durationsChanged}</b>
                    </span>
                    <span>
                      Inserted / Deleted{" "}
                      <b>
                        +{activeDiff.notesInserted + activeDiff.restsInserted} / −
                        {activeDiff.notesDeleted + activeDiff.restsDeleted}
                      </b>
                    </span>
                    <span>
                      Ties changed <b>{activeDiff.tiesChanged}</b>
                    </span>
                    <span>
                      Commands logged <b>{editorProject.editLog.length}</b>
                    </span>
                  </div>
                </div>

                <div className="export-card">
                  <span className="eyebrow">VALIDATION STATUS</span>
                  <p>
                    {activeValidation.valid
                      ? "✓ Arrangement passes all monophonic, duration, spelling, and tie invariants."
                      : `✕ ${activeValidation.blockingErrors.length} blocking error(s) must be resolved before export.`}
                  </p>
                  {activeValidation.allIssues.map((issue, idx) => (
                    <p key={`${issue.code}-${idx}`} className={`validation-item ${issue.severity}`}>
                      <b>{issue.code}</b> {issue.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="score-preview">
              <MusicStage
                document={adaptAbc(
                  editorProject ? editedAbc : candidate ? toAbc(candidate) : "X:1\nK:C\nC |\n",
                )}
                mode="score"
                activeBeat={0}
                accessibleLabel="Export arrangement preview"
                ribbons="none"
              />
            </div>

            <div className="export-row" role="group" aria-label="Export downloads">
              <button
                type="button"
                className="listen"
                onClick={() => {
                  if (editorProject) {
                    void player.playMelody(editableArrangementToMelody(editorProject.arrangement));
                  } else if (candidate) {
                    void auditionCandidate(candidate);
                  }
                }}
              >
                ▶ Sampled harmonica
              </button>
              <button
                type="button"
                disabled={Boolean(activeValidation && !activeValidation.valid)}
                onClick={() =>
                  downloadFile(
                    `${fileStem}.abc`,
                    editorProject ? editedAbc : toAbc(candidate!),
                    "text/plain",
                  )
                }
              >
                Download ABC
              </button>
              <button
                type="button"
                disabled={Boolean(activeValidation && !activeValidation.valid)}
                onClick={() =>
                  downloadFile(
                    `${fileStem}.mid`,
                    editorProject
                      ? serializeArrangementToMidi(editorProject.arrangement)
                      : toMidi(candidate!),
                    "audio/midi",
                  )
                }
              >
                Download MIDI
              </button>
              <button
                type="button"
                disabled={Boolean(activeValidation && !activeValidation.valid)}
                onClick={() =>
                  downloadFile(
                    `${fileStem}.musicxml`,
                    editorProject
                      ? serializeArrangementToMusicXml(editorProject.arrangement)
                      : toMusicXml(candidate!),
                    "application/vnd.recordare.musicxml+xml",
                  )
                }
              >
                Download MusicXML 4.0
              </button>
              <button
                type="button"
                disabled={Boolean(activeValidation && !activeValidation.valid)}
                onClick={() =>
                  downloadFile(
                    `${fileStem}.arrangement.json`,
                    editorProject
                      ? serializeCanonicalArrangementJson(editorProject.arrangement)
                      : `${stableStringify(project)}\n`,
                    "application/json",
                  )
                }
              >
                Download Canonical JSON
              </button>
              {editorProject && (
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      `${fileStem}.harmonica-project.json`,
                      serializeEditorProjectJson(editorProject),
                      "application/json",
                    )
                  }
                >
                  Save Editor Project (.harmonica-project.json)
                </button>
              )}
              <button
                type="button"
                className="primary"
                disabled={Boolean(activeValidation && !activeValidation.valid)}
                onClick={() =>
                  openInSongPractice(
                    editorProject ? editedAbc : candidate ? toAbc(candidate) : "",
                  )
                }
              >
                Open in Song Practice
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="build-identity">
        Local-first workbench · Build <code>{__BUILD_META__.sourceCommit.slice(0, 12)}</code> · v
        {__BUILD_META__.version}
      </footer>
    </div>
  );
}
