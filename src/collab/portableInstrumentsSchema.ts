import {
  Authority,
  ChangeBuilder,
  Client,
  DerivedGraph,
  SequenceAllocator,
  applyChanges,
  createAllocator,
  defineDocumentSchema,
  editableCopy,
  exportDocument,
  fromTable,
  isComponentNode,
  parseDocument,
  proposeEdit,
  rebaseProposal,
  serializeDocument,
  toTable,
  type ComponentNode,
  type DocumentModel,
  type Proposal,
  type SchemaProfile,
  type Table,
} from "../vendor/ml-collab-codec/index.ts";
import { summarize } from "../vendor/ml-collab-codec/core/summary.ts";
import type { WrittenPitch } from "../music/melody";
import {
  createEditableArrangementFromCandidate,
  formatWrittenPitch,
  midiFromWrittenPitch,
  writtenPitchFromMidiAndPolicy,
} from "../score-editor/EditableArrangement";
import {
  CANONICAL_PPQ,
  type EditableArrangement,
  type EditableArrangementProject,
  type EditableEvent,
} from "../score-editor/editorTypes";
import { measureTicksForMeter } from "../score-editor/validation";
import type { Project } from "../score-import/core";

export const PORTABLE_INSTRUMENTS_SCHEMA_ID = "animaticml.portable-instruments.project";
export const PORTABLE_INSTRUMENTS_SCHEMA_VERSION = "1.0.0";

export const PORTABLE_INSTRUMENTS_SCHEMA: SchemaProfile = defineDocumentSchema({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  id: PORTABLE_INSTRUMENTS_SCHEMA_ID,
  version: PORTABLE_INSTRUMENTS_SCHEMA_VERSION,
  rootTag: "project",
  components: {
    project: {
      identity: "stable",
      content: {
        mode: "element",
        allowedTags: ["source", "arrangement", "lyrics", "board"],
      },
      props: {
        type: "object",
        properties: {
          title: { type: "string" },
          composer: { type: "string", default: "" },
          tempo: { type: "integer", minimum: 30, maximum: 260, default: 100 },
          meter: { type: "string", default: "4/4" },
          key: { type: "string", default: "C" },
          mode: { type: "string", default: "major" },
          prefer: { type: "string", enum: ["sharps", "flats"], default: "sharps" },
          activeInstrument: { type: "string", default: "harmonica-c12" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
    source: {
      identity: "stable",
      content: { mode: "none" },
      props: {
        type: "object",
        properties: {
          kind: { type: "string" },
          file: { type: "string" },
          sha256: { type: "string" },
          selectedCandidate: { type: "string" },
          noteCount: { type: "integer", minimum: 0, default: 0 },
        },
        required: ["kind", "file", "sha256", "selectedCandidate"],
        additionalProperties: false,
      },
    },
    arrangement: {
      identity: "stable",
      content: {
        mode: "element",
        allowedTags: ["measure"],
      },
      props: {
        type: "object",
        properties: {
          instrument: { type: "string", default: "harmonica-c12" },
          ppq: { type: "integer", default: 960 },
        },
        additionalProperties: false,
      },
    },
    measure: {
      identity: "stable",
      content: {
        mode: "element",
        allowedTags: ["note", "rest"],
      },
      props: {
        type: "object",
        properties: {
          number: { type: "integer", minimum: 1 },
        },
        required: ["number"],
        additionalProperties: false,
      },
    },
    note: {
      identity: "stable",
      content: { mode: "none" },
      props: {
        type: "object",
        properties: {
          start: { type: "integer", minimum: 0 },
          dur: { type: "integer", minimum: 1 },
          midi: { type: "integer", minimum: 0, maximum: 127 },
          pitch: { type: "string" },
          tie: { type: "string", enum: ["none", "start", "end", "both"], default: "none" },
          origin: {
            type: "string",
            enum: ["imported", "inserted", "split", "derived"],
            default: "imported",
          },
          src: { type: "string", default: "" },
        },
        required: ["start", "dur", "midi", "pitch"],
        additionalProperties: false,
      },
    },
    rest: {
      identity: "stable",
      content: { mode: "none" },
      props: {
        type: "object",
        properties: {
          start: { type: "integer", minimum: 0 },
          dur: { type: "integer", minimum: 1 },
          origin: {
            type: "string",
            enum: ["imported", "inserted", "split", "derived"],
            default: "imported",
          },
        },
        required: ["start", "dur"],
        additionalProperties: false,
      },
    },
    lyrics: {
      identity: "stable",
      content: {
        mode: "element",
        allowedTags: ["stanza"],
      },
      props: {
        type: "object",
        properties: {
          lang: { type: "string", default: "en" },
          level: { type: "string", default: "B1" },
        },
        additionalProperties: false,
      },
    },
    stanza: {
      identity: "stable",
      content: {
        mode: "element",
        allowedTags: ["line"],
      },
      props: {
        type: "object",
        properties: {
          role: { type: "string", default: "verse" },
        },
        additionalProperties: false,
      },
    },
    line: {
      identity: "stable",
      content: { mode: "mixed" },
      props: {
        type: "object",
        properties: {
          measures: { type: "string", default: "1" },
        },
        additionalProperties: false,
      },
    },
    board: {
      identity: "stable",
      content: {
        mode: "element",
        allowedTags: ["card", "connector"],
      },
      props: {
        type: "object",
        properties: {
          cameraX: { type: "number", default: 0 },
          cameraY: { type: "number", default: 0 },
          cameraZoom: { type: "number", default: 1 },
        },
        additionalProperties: false,
      },
    },
    card: {
      identity: "stable",
      content: { mode: "none" },
      props: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["source", "score", "instrument", "lyrics", "agent"],
          },
          title: { type: "string" },
          target: { type: "string", default: "" },
          x: { type: "number" },
          y: { type: "number" },
          w: { type: "number" },
          h: { type: "number" },
        },
        required: ["kind", "title", "x", "y", "w", "h"],
        additionalProperties: false,
      },
    },
    connector: {
      identity: "stable",
      content: { mode: "none" },
      props: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string", default: "" },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
});

export interface BoardCardLayout {
  id: string;
  kind: "source" | "score" | "instrument" | "lyrics" | "agent";
  title: string;
  target: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardConnectorLayout {
  id: string;
  from: string;
  to: string;
  label: string;
}

export function parsePitchString(
  pitchStr: string,
  fallbackMidi: number,
  prefer: "sharps" | "flats" = "sharps",
): WrittenPitch {
  const m = pitchStr.trim().match(/^([A-G])([#♯b♭♮=]?)(\d)$/);
  if (!m) {
    return writtenPitchFromMidiAndPolicy(fallbackMidi, prefer);
  }
  const step = m[1] as WrittenPitch["step"];
  const accRaw = m[2];
  const octave = Number(m[3]);
  const accidental: WrittenPitch["accidental"] =
    accRaw === "#" || accRaw === "♯"
      ? "sharp"
      : accRaw === "b" || accRaw === "♭"
        ? "flat"
        : accRaw === "♮" || accRaw === "="
          ? "natural"
          : undefined;
  return { step, accidental, octave };
}

export function formatAsciiPitch(pitch?: WrittenPitch, fallbackMidi?: number): string {
  const w = pitch ?? writtenPitchFromMidiAndPolicy(fallbackMidi ?? 60, "sharps");
  const acc =
    w.accidental === "sharp"
      ? "#"
      : w.accidental === "flat"
        ? "b"
        : w.accidental === "natural"
          ? "="
          : "";
  return `${w.step}${acc}${w.octave}`;
}

export const DEFAULT_BOARD_CARDS: readonly BoardCardLayout[] = [
  {
    id: "card-source",
    kind: "source",
    title: "Source & Candidates",
    target: "src-main",
    x: 40,
    y: 60,
    w: 320,
    h: 260,
  },
  {
    id: "card-score",
    kind: "score",
    title: "Score & Timing Arrangement",
    target: "arr-main",
    x: 410,
    y: 40,
    w: 760,
    h: 300,
  },
  {
    id: "card-instrument",
    kind: "instrument",
    title: "Physical Instrument Map",
    target: "arr-main",
    x: 410,
    y: 380,
    w: 760,
    h: 250,
  },
  {
    id: "card-lyrics",
    kind: "lyrics",
    title: "Lyrics & Creative Brief",
    target: "lyr-main",
    x: 40,
    y: 360,
    w: 320,
    h: 270,
  },
];

export const DEFAULT_BOARD_CONNECTORS: readonly BoardConnectorLayout[] = [
  {
    id: "conn-source-score",
    from: "card-source",
    to: "card-score",
    label: "extracted line",
  },
  {
    id: "conn-score-instrument",
    from: "card-score",
    to: "card-instrument",
    label: "projection",
  },
  {
    id: "conn-lyrics-score",
    from: "card-lyrics",
    to: "card-score",
    label: "phrasing",
  },
];

export function arrangementProjectToCollabModel(
  editorProject: EditableArrangementProject,
  activeInstrument = "harmonica-c12",
  cards: readonly BoardCardLayout[] = DEFAULT_BOARD_CARDS,
  connectors: readonly BoardConnectorLayout[] = DEFAULT_BOARD_CONNECTORS,
  lyricLines: readonly string[] = [
    "Play a familiar melody on the first day,",
    "See where every pitch lives on your instrument.",
  ],
): DocumentModel {
  const arr = editorProject.arrangement;
  const src = editorProject.sourceProject;
  const measureTicks = measureTicksForMeter(arr.meter);

  const byMeasure = new Map<number, ComponentNode[]>();
  for (const ev of arr.events) {
    const mNum = Math.floor(ev.startTick / measureTicks) + 1;
    const list = byMeasure.get(mNum) ?? [];
    if (ev.kind === "note") {
      const tieVal =
        ev.tieIn && ev.tieOut ? "both" : ev.tieOut ? "start" : ev.tieIn ? "end" : "none";
      list.push({
        id: ev.id,
        tag: "note",
        props: {
          start: ev.startTick,
          dur: ev.durationTick,
          midi: ev.midi ?? 60,
          pitch: formatAsciiPitch(ev.writtenPitch, ev.midi),
          tie: tieVal,
          origin: ev.origin,
          src: ev.sourceEventIds[0] ?? "",
        },
        content: [],
      });
    } else {
      list.push({
        id: ev.id,
        tag: "rest",
        props: {
          start: ev.startTick,
          dur: ev.durationTick,
          origin: ev.origin,
        },
        content: [],
      });
    }
    byMeasure.set(mNum, list);
  }

  if (byMeasure.size === 0) {
    byMeasure.set(1, []);
  }

  const measureNodes: ComponentNode[] = [...byMeasure.keys()]
    .sort((a, b) => a - b)
    .map((mNum) => ({
      id: `m-${mNum}`,
      tag: "measure",
      props: { number: mNum },
      content: byMeasure.get(mNum)!,
    }));

  const sourceNode: ComponentNode = {
    id: "src-main",
    tag: "source",
    props: {
      kind: src.provenance.sourceType,
      file: src.provenance.fileName,
      sha256: src.provenance.sha256.slice(0, 16),
      selectedCandidate: editorProject.sourceCandidateId,
      noteCount: arr.events.filter((e) => e.kind === "note").length,
    },
    content: [],
  };

  const arrangementNode: ComponentNode = {
    id: arr.id || "arr-main",
    tag: "arrangement",
    props: {
      instrument: activeInstrument,
      ppq: CANONICAL_PPQ,
    },
    content: measureNodes,
  };

  const lyricsNode: ComponentNode = {
    id: "lyr-main",
    tag: "lyrics",
    props: { lang: "en", level: "B1" },
    content: [
      {
        id: "stanza-1",
        tag: "stanza",
        props: { role: "verse" },
        content: lyricLines.map((line, i) => ({
          id: `line-${i + 1}`,
          tag: "line",
          props: { measures: `${i * 2 + 1}..${i * 2 + 2}` },
          content: [line],
        })),
      },
    ],
  };

  const boardNode: ComponentNode = {
    id: "board-main",
    tag: "board",
    props: { cameraX: 0, cameraY: 0, cameraZoom: 1 },
    content: [
      ...cards.map(
        (c): ComponentNode => ({
          id: c.id,
          tag: "card",
          props: {
            kind: c.kind,
            title: c.title,
            target: c.target,
            x: c.x,
            y: c.y,
            w: c.w,
            h: c.h,
          },
          content: [],
        }),
      ),
      ...connectors.map(
        (conn): ComponentNode => ({
          id: conn.id,
          tag: "connector",
          props: {
            from: conn.from,
            to: conn.to,
            label: conn.label,
          },
          content: [],
        }),
      ),
    ],
  };

  return {
    schemaId: PORTABLE_INSTRUMENTS_SCHEMA_ID,
    schemaVersion: PORTABLE_INSTRUMENTS_SCHEMA_VERSION,
    root: {
      id: `proj-${src.provenance.sha256.slice(0, 8)}`,
      tag: "project",
      props: {
        title: arr.title,
        composer: arr.composer ?? "",
        tempo: arr.tempoQpm,
        meter: `${arr.meter.numerator}/${arr.meter.denominator}`,
        key: arr.key.tonic,
        mode: arr.key.mode,
        prefer: arr.key.prefer,
        activeInstrument,
      },
      content: [sourceNode, arrangementNode, lyricsNode, boardNode],
    },
  };
}

export function collabModelToArrangement(
  model: DocumentModel,
  fallbackId = "arr-main",
): {
  arrangement: EditableArrangement;
  activeInstrument: string;
  cards: BoardCardLayout[];
  connectors: BoardConnectorLayout[];
  lyrics: string[];
} {
  const root = model.root;
  const title = String(root.props["title"] ?? "Untitled");
  const composer = String(root.props["composer"] ?? "");
  const tempoQpm = Number(root.props["tempo"] ?? 100);
  const meterStr = String(root.props["meter"] ?? "4/4");
  const [numStr = "4", denStr = "4"] = meterStr.split("/");
  const meter = {
    numerator: Number(numStr) || 4,
    denominator: Number(denStr) || 4,
  };
  const prefer = root.props["prefer"] === "flats" ? "flats" : "sharps";
  const key = {
    tonic: String(root.props["key"] ?? "C"),
    mode: String(root.props["mode"] ?? "major"),
    prefer: prefer as "sharps" | "flats",
  };
  const activeInstrument = String(root.props["activeInstrument"] ?? "harmonica-c12");

  const events: EditableEvent[] = [];
  const cards: BoardCardLayout[] = [];
  const connectors: BoardConnectorLayout[] = [];
  const lyrics: string[] = [];
  let arrangementId = fallbackId;

  for (const child of root.content ?? []) {
    if (!isComponentNode(child)) continue;
    if (child.tag === "arrangement") {
      arrangementId = child.id ?? fallbackId;
      for (const mNode of child.content ?? []) {
        if (!isComponentNode(mNode) || mNode.tag !== "measure") continue;
        for (const evNode of mNode.content ?? []) {
          if (!isComponentNode(evNode)) continue;
          const id = evNode.id ?? `ev-${events.length}`;
          const startTick = Number(evNode.props["start"] ?? 0);
          const durationTick = Math.max(1, Number(evNode.props["dur"] ?? 480));
          const origin = (evNode.props["origin"] ?? "imported") as EditableEvent["origin"];
          if (evNode.tag === "note") {
            const midi = Number(evNode.props["midi"] ?? 60);
            const pitchStr = String(evNode.props["pitch"] ?? formatAsciiPitch(undefined, midi));
            const writtenPitch = parsePitchString(pitchStr, midi, prefer);
            const tieStr = String(evNode.props["tie"] ?? "none");
            const srcId = String(evNode.props["src"] ?? "");
            events.push({
              id,
              kind: "note",
              startTick,
              durationTick,
              midi,
              writtenPitch,
              tieIn: tieStr === "end" || tieStr === "both",
              tieOut: tieStr === "start" || tieStr === "both",
              sourceEventIds: srcId ? [srcId] : [],
              warnings: [],
              origin,
            });
          } else if (evNode.tag === "rest") {
            events.push({
              id,
              kind: "rest",
              startTick,
              durationTick,
              sourceEventIds: [],
              warnings: [],
              origin,
            });
          }
        }
      }
    } else if (child.tag === "board") {
      for (const item of child.content ?? []) {
        if (!isComponentNode(item)) continue;
        if (item.tag === "card") {
          cards.push({
            id: item.id ?? `card-${cards.length}`,
            kind: (item.props["kind"] ?? "score") as BoardCardLayout["kind"],
            title: String(item.props["title"] ?? "Card"),
            target: String(item.props["target"] ?? ""),
            x: Number(item.props["x"] ?? 0),
            y: Number(item.props["y"] ?? 0),
            w: Number(item.props["w"] ?? 320),
            h: Number(item.props["h"] ?? 240),
          });
        } else if (item.tag === "connector") {
          connectors.push({
            id: item.id ?? `conn-${connectors.length}`,
            from: String(item.props["from"] ?? ""),
            to: String(item.props["to"] ?? ""),
            label: String(item.props["label"] ?? ""),
          });
        }
      }
    } else if (child.tag === "lyrics") {
      for (const st of child.content ?? []) {
        if (!isComponentNode(st)) continue;
        for (const ln of st.content ?? []) {
          if (!isComponentNode(ln)) continue;
          const txt = (ln.content ?? []).filter((c) => typeof c === "string").join("");
          if (txt) lyrics.push(txt);
        }
      }
    }
  }

  // Ensure monotonic startTicks
  let cursor = 0;
  for (const e of events) {
    e.startTick = cursor;
    cursor += e.durationTick;
  }

  return {
    arrangement: {
      id: arrangementId,
      title,
      composer: composer || undefined,
      tempoQpm,
      meter,
      key,
      canonicalPpq: CANONICAL_PPQ,
      events,
    },
    activeInstrument,
    cards: cards.length > 0 ? cards : [...DEFAULT_BOARD_CARDS],
    connectors: connectors.length > 0 ? connectors : [...DEFAULT_BOARD_CONNECTORS],
    lyrics,
  };
}

export interface AgentArtifactProposalSummary {
  proposal: Proposal;
  title: string;
  rationale: string;
  beforeTaggedSource: string;
  afterTaggedSource: string;
  changedEventIds: string[];
  previewArrangement: EditableArrangement;
}

export type BuiltInAgentSkill =
  | "fit-instrument-range"
  | "simplify-melody"
  | "shift-octave-up"
  | "shift-octave-down"
  | "transpose-up-2"
  | "humanize-lyrics";

/**
 * Runtime authority & client powered by ml-collab-codec (`Authority`, `Client`, `DerivedGraph`, `proposeEdit`, `rebaseProposal`).
 */
export class CollabProjectDocument {
  readonly authority: Authority;
  readonly client: Client;
  readonly graph: DerivedGraph;
  readonly sourceProject: Project;
  readonly sourceCandidateId: string;
  private agentSeq = 1;
  private personSeq = 1;
  private pendingProposal?: AgentArtifactProposalSummary;
  private scheduledFrames: (() => void)[] = [];
  private musicalComputeCount = 0;

  constructor(
    editorProject: EditableArrangementProject,
    activeInstrument = "harmonica-c12",
    lyrics?: readonly string[],
  ) {
    this.sourceProject = editorProject.sourceProject;
    this.sourceCandidateId = editorProject.sourceCandidateId;

    const initialModel = arrangementProjectToCollabModel(
      editorProject,
      activeInstrument,
      DEFAULT_BOARD_CARDS,
      DEFAULT_BOARD_CONNECTORS,
      lyrics ? [...lyrics] : undefined,
    );
    const initialTable = toTable(initialModel, createAllocator());

    this.authority = Authority.create("portable-instruments-doc", "epoch-1", initialTable);
    this.client = new Client({
      documentId: "portable-instruments-doc",
      historyEpoch: "epoch-1",
      allocator: SequenceAllocator.ephemeral("person"),
      actor: "person",
      table: this.authority.getTable(),
      revision: this.authority.getRevision(),
    });

    this.graph = new DerivedGraph(this.client.getSnapshot().table, {
      schedule: (task) => {
        this.scheduledFrames.push(task);
        return () => undefined;
      },
    });

    // DerivedGraph only recomputes musical arrangement when musical properties change, NOT when <board> cards move!
    this.graph.define("musical:summary", (ctx) => {
      this.musicalComputeCount += 1;
      const title = String(ctx.prop("$root", ["title"]) ?? "");
      const tempo = Number(ctx.prop("$root", ["tempo"]) ?? 100);
      const instrument = String(ctx.prop("$root", ["activeInstrument"]) ?? "harmonica-c12");
      return { title, tempo, instrument, computeCount: this.musicalComputeCount };
    });
  }

  getMusicalSummary(): { title: string; tempo: number; instrument: string; computeCount: number } {
    return this.graph.read("musical:summary");
  }

  static fromSourceProject(
    sourceProject: Project,
    candidateId?: string,
    activeInstrument = "harmonica-c12",
  ): CollabProjectDocument {
    const draft = createEditableArrangementFromCandidate(sourceProject, candidateId);
    return new CollabProjectDocument(draft, activeInstrument);
  }

  get table(): Table {
    return this.authority.getTable();
  }

  get revision(): number {
    return this.authority.getRevision();
  }

  get model(): DocumentModel {
    return fromTable(
      this.table,
      PORTABLE_INSTRUMENTS_SCHEMA_ID,
      PORTABLE_INSTRUMENTS_SCHEMA_VERSION,
    );
  }

  toTaggedSource(): string {
    return serializeDocument(this.model, PORTABLE_INSTRUMENTS_SCHEMA);
  }

  getDecodedState() {
    return collabModelToArrangement(this.model);
  }

  get pendingAgentProposal(): AgentArtifactProposalSummary | undefined {
    return this.pendingProposal;
  }

  flushDerivedGraph(): void {
    const tasks = this.scheduledFrames.splice(0);
    for (const t of tasks) t();
  }

  /**
   * Direct human edits via ChangeBuilder (e.g. moving a card on the canvas or changing a note's pitch).
   */
  moveBoardCard(cardId: string, x: number, y: number): void {
    const prevTable = this.authority.getTable();
    if (!prevTable.has(cardId)) return;
    const seq = this.personSeq++;
    const changes = new ChangeBuilder(prevTable, { replica: "person", seq })
      .set(cardId, "x", Math.round(x))
      .set(cardId, "y", Math.round(y)).changes;
    this.authority.submit(
      {
        profile: "sdl.scalar-prefix/1",
        opFormat: "sdl.ops/2",
        documentId: "portable-instruments-doc",
        historyEpoch: "epoch-1",
        replica: "person",
        seq,
        baseRevision: this.authority.getRevision(),
        changes,
        meta: { group: `person#${seq}` },
      },
      { actor: "person" },
    );
    const nextTable = this.authority.getTable();
    this.graph.update(nextTable, summarize(prevTable, nextTable, changes));
    this.flushDerivedGraph();
  }

  setActiveInstrument(instrumentId: string): void {
    const prevTable = this.authority.getTable();
    const seq = this.personSeq++;
    const builder = new ChangeBuilder(prevTable, { replica: "person", seq }).set(
      "$root",
      "activeInstrument",
      instrumentId,
    );
    const changes = builder.changes;
    this.authority.submit(
      {
        profile: "sdl.scalar-prefix/1",
        opFormat: "sdl.ops/2",
        documentId: "portable-instruments-doc",
        historyEpoch: "epoch-1",
        replica: "person",
        seq,
        baseRevision: this.authority.getRevision(),
        changes,
        meta: { group: `person#${seq}` },
      },
      { actor: "person" },
    );
    const nextTable = this.authority.getTable();
    this.graph.update(nextTable, summarize(prevTable, nextTable, changes));
    this.flushDerivedGraph();
  }

  setNotePitch(noteId: string, nextMidi: number): void {
    const prevTable = this.authority.getTable();
    if (!prevTable.has(noteId)) return;
    const clamped = Math.max(24, Math.min(108, Math.round(nextMidi)));
    const prefer = this.model.root.props["prefer"] === "flats" ? "flats" : "sharps";
    const pitchStr = formatAsciiPitch(writtenPitchFromMidiAndPolicy(clamped, prefer), clamped);
    const seq = this.personSeq++;
    const changes = new ChangeBuilder(prevTable, { replica: "person", seq })
      .set(noteId, "midi", clamped)
      .set(noteId, "pitch", pitchStr).changes;
    this.authority.submit(
      {
        profile: "sdl.scalar-prefix/1",
        opFormat: "sdl.ops/2",
        documentId: "portable-instruments-doc",
        historyEpoch: "epoch-1",
        replica: "person",
        seq,
        baseRevision: this.authority.getRevision(),
        changes,
        meta: { group: `person#${seq}` },
      },
      { actor: "person" },
    );
    const nextTable = this.authority.getTable();
    this.graph.update(nextTable, summarize(prevTable, nextTable, changes));
    this.flushDerivedGraph();
  }

  /**
   * Synchronize a full EditableArrangement back into the ml-collab-codec document as an identity-aware diff commit.
   */
  syncFromArrangement(
    arrangement: EditableArrangement,
    activeInstrument?: string,
  ): void {
    const prevTable = this.authority.getTable();
    const currentDecoded = this.getDecodedState();
    const nextModel = arrangementProjectToCollabModel(
      {
        schemaVersion: 1,
        sourceProject: this.sourceProject,
        sourceCandidateId: this.sourceCandidateId,
        arrangement,
        editLog: [],
        settingsHash: "sync",
      },
      activeInstrument ?? currentDecoded.activeInstrument,
      currentDecoded.cards,
      currentDecoded.connectors,
      currentDecoded.lyrics,
    );
    const read = {
      table: prevTable,
      revision: this.authority.getRevision(),
    };
    const seq = this.personSeq++;
    const proposal = proposeEdit(read, nextModel.root, { replica: "person", seq });
    if (proposal.changes.length === 0) return;
    this.authority.submit(
      {
        profile: "sdl.scalar-prefix/1",
        opFormat: "sdl.ops/2",
        documentId: "portable-instruments-doc",
        historyEpoch: "epoch-1",
        replica: "person",
        seq,
        baseRevision: read.revision,
        changes: proposal.changes,
        meta: { group: `person#${seq}` },
      },
      { actor: "person" },
    );
    const nextTable = this.authority.getTable();
    this.graph.update(nextTable, summarize(prevTable, nextTable, proposal.changes));
    this.flushDerivedGraph();
  }

  /**
   * Agent edits the tagged artifact directly (`editableCopy` or parsed tagged source) and proposes the identity-aware diff via `proposeEdit`.
   */
  proposeAgentEditFromTaggedSource(
    editedTaggedSource: string,
    title = "Agent artifact proposal",
    rationale = "Proposed direct edit on the tagged project artifact.",
  ): AgentArtifactProposalSummary {
    const parsed = parseDocument(editedTaggedSource, PORTABLE_INSTRUMENTS_SCHEMA);
    if (!parsed.ok) {
      throw new Error(
        `Invalid agent artifact syntax:\n${parsed.diagnostics.map((d) => `${d.path}: ${d.message}`).join("\n")}`,
      );
    }
    const read = {
      table: this.authority.getTable(),
      revision: this.authority.getRevision(),
    };
    const beforeTaggedSource = this.toTaggedSource();
    const seq = this.agentSeq++;
    const proposal = proposeEdit(read, parsed.value.root, { replica: "agent", seq });

    const beforeArr = this.getDecodedState().arrangement;
    const afterArr = collabModelToArrangement(parsed.value).arrangement;
    const beforeById = new Map(beforeArr.events.map((e) => [e.id, e]));
    const changedEventIds = afterArr.events
      .filter((e) => {
        const orig = beforeById.get(e.id);
        return (
          !orig ||
          orig.midi !== e.midi ||
          orig.durationTick !== e.durationTick ||
          orig.kind !== e.kind ||
          formatWrittenPitch(orig.writtenPitch) !== formatWrittenPitch(e.writtenPitch)
        );
      })
      .map((e) => e.id);

    const summary: AgentArtifactProposalSummary = {
      proposal,
      title,
      rationale,
      beforeTaggedSource,
      afterTaggedSource: serializeDocument(parsed.value, PORTABLE_INSTRUMENTS_SCHEMA),
      changedEventIds,
      previewArrangement: afterArr,
    };
    this.pendingProposal = summary;
    return summary;
  }

  /**
   * Built-in local agent skills that mutate an `editableCopy` of the document artifact and propose changes via `proposeEdit`.
   */
  proposeAgentSkill(
    skill: BuiltInAgentSkill,
    selectedEventIds: string[] = [],
    targetRange: { minMidi: number; maxMidi: number } = { minMidi: 60, maxMidi: 92 },
  ): AgentArtifactProposalSummary {
    const read = {
      table: this.authority.getTable(),
      revision: this.authority.getRevision(),
    };
    const copy = editableCopy(
      fromTable(
        read.table,
        PORTABLE_INSTRUMENTS_SCHEMA_ID,
        PORTABLE_INSTRUMENTS_SCHEMA_VERSION,
      ),
    );
    const selectedSet = new Set(selectedEventIds);
    const prefer = copy.root.props["prefer"] === "flats" ? "flats" : "sharps";

    let title = "";
    let rationale = "";

    const visitNotes = (fn: (noteNode: { id?: string; props: Record<string, unknown> }, index: number) => void) => {
      let idx = 0;
      for (const child of copy.root.content ?? []) {
        if (typeof child === "string" || child.tag !== "arrangement") continue;
        for (const mNode of child.content ?? []) {
          if (typeof mNode === "string" || mNode.tag !== "measure") continue;
          for (const evNode of mNode.content ?? []) {
            if (typeof evNode === "string" || evNode.tag !== "note") continue;
            if (selectedSet.size === 0 || (evNode.id && selectedSet.has(evNode.id))) {
              fn(evNode, idx);
            }
            idx++;
          }
        }
      }
    };

    if (skill === "fit-instrument-range") {
      let shiftedCount = 0;
      visitNotes((noteNode) => {
        let midi = Number(noteNode.props["midi"] ?? 60);
        const orig = midi;
        while (midi < targetRange.minMidi) midi += 12;
        while (midi > targetRange.maxMidi) midi -= 12;
        if (midi !== orig) {
          noteNode.props["midi"] = midi;
          noteNode.props["pitch"] = formatAsciiPitch(
            writtenPitchFromMidiAndPolicy(midi, prefer),
            midi,
          );
          shiftedCount++;
        }
      });
      title = "Fit melody into instrument playable range";
      rationale = `Folded ${shiftedCount} out-of-range note(s) by octave into MIDI ${targetRange.minMidi}–${targetRange.maxMidi} while preserving melodic pitch classes.`;
    } else if (skill === "simplify-melody") {
      let prevMidi: number | undefined;
      let simplified = 0;
      visitNotes((noteNode) => {
        let midi = Number(noteNode.props["midi"] ?? 60);
        if (prevMidi !== undefined && Math.abs(midi - prevMidi) > 9) {
          midi += midi > prevMidi ? -12 : 12;
          midi = Math.max(targetRange.minMidi, Math.min(targetRange.maxMidi, midi));
          noteNode.props["midi"] = midi;
          noteNode.props["pitch"] = formatAsciiPitch(
            writtenPitchFromMidiAndPolicy(midi, prefer),
            midi,
          );
          simplified++;
        }
        prevMidi = midi;
      });
      title = "Simplify large melodic leaps for smoother playability";
      rationale = `Smoothed ${simplified} wide leap(s) (> 9 semitones) so neighboring notes stay in a comfortable hand/breath position.`;
    } else if (skill === "shift-octave-up" || skill === "shift-octave-down") {
      const delta = skill === "shift-octave-up" ? 12 : -12;
      let count = 0;
      visitNotes((noteNode) => {
        const midi = Math.max(24, Math.min(108, Number(noteNode.props["midi"] ?? 60) + delta));
        noteNode.props["midi"] = midi;
        noteNode.props["pitch"] = formatAsciiPitch(
          writtenPitchFromMidiAndPolicy(midi, prefer),
          midi,
        );
        count++;
      });
      title = `Shift ${selectedSet.size ? "selection" : "arrangement"} ${delta > 0 ? "+1" : "−1"} octave`;
      rationale = `Shifted ${count} note(s) by ${delta} semitones in the tagged arrangement artifact.`;
    } else if (skill === "transpose-up-2") {
      let count = 0;
      visitNotes((noteNode) => {
        const midi = Math.max(24, Math.min(108, Number(noteNode.props["midi"] ?? 60) + 2));
        noteNode.props["midi"] = midi;
        noteNode.props["pitch"] = formatAsciiPitch(
          writtenPitchFromMidiAndPolicy(midi, prefer),
          midi,
        );
        count++;
      });
      title = "Transpose +2 semitones (whole step up)";
      rationale = `Transposed ${count} note(s) up by 2 semitones.`;
    } else if (skill === "humanize-lyrics") {
      for (const child of copy.root.content ?? []) {
        if (typeof child === "string" || child.tag !== "lyrics") continue;
        for (const st of child.content ?? []) {
          if (typeof st === "string" || st.tag !== "stanza") continue;
          st.content = [
            {
              id: "line-1",
              tag: "line",
              props: { measures: "1..2" },
              content: ["Follow the glowing tone across the reed and tine,"],
            },
            {
              id: "line-2",
              tag: "line",
              props: { measures: "3..4" },
              content: ["Every breath and pluck brings the melody in line."],
            },
          ];
        }
      }
      title = "Refine B1-level singable verse lyrics";
      rationale = "Updated <lyrics><stanza> lines with rhythmic B1-level phrasing aligned to measures 1–4.";
    }

    const updatedSerialized = serializeDocument(
      {
        schemaId: PORTABLE_INSTRUMENTS_SCHEMA_ID,
        schemaVersion: PORTABLE_INSTRUMENTS_SCHEMA_VERSION,
        root: copy.root as unknown as ComponentNode,
      },
      PORTABLE_INSTRUMENTS_SCHEMA,
    );
    return this.proposeAgentEditFromTaggedSource(updatedSerialized, title, rationale);
  }

  /**
   * Rebases the pending agent proposal over any concurrent human edits (`rebaseProposal`) and applies it to the authority.
   */
  applyPendingProposal(): { status: string; appliedChanges: number } {
    if (!this.pendingProposal) {
      throw new Error("No pending agent proposal to apply.");
    }
    const prevTable = this.authority.getTable();
    const rebased = rebaseProposal(this.pendingProposal.proposal, this.authority);
    if (rebased.status !== "rebased") {
      throw new Error(`Proposal could not be cleanly rebased (${rebased.status}).`);
    }
    if (rebased.changes.length > 0) {
      const seq = this.agentSeq++;
      this.authority.submit(
        {
          profile: "sdl.scalar-prefix/1",
          opFormat: "sdl.ops/2",
          documentId: "portable-instruments-doc",
          historyEpoch: "epoch-1",
          replica: "agent",
          seq,
          baseRevision: rebased.revision,
          changes: rebased.changes,
          meta: {
            group: `agent#${seq}`,
          },
        },
        { actor: "agent" },
      );
      const nextTable = this.authority.getTable();
      this.graph.update(nextTable, summarize(prevTable, nextTable, rebased.changes));
      this.flushDerivedGraph();
    }
    const count = rebased.changes.length;
    this.pendingProposal = undefined;
    return { status: "applied", appliedChanges: count };
  }

  rejectPendingProposal(): void {
    this.pendingProposal = undefined;
  }

  exportProviderSchema(provider: "openai" | "anthropic" | "gemini" = "openai") {
    return exportDocument(PORTABLE_INSTRUMENTS_SCHEMA, provider);
  }
}

export { applyChanges };
