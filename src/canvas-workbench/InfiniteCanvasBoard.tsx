import { useEffect, useRef, useState } from "react";
import {
  AccessibilityLayer,
  EventRouter,
  RecordingContext,
  Renderer,
  Scene,
} from "../vendor/canvas-ir/index";
import { drawTextLayout, layoutText } from "../vendor/canvas-ir-text/index";
import {
  type AgentArtifactProposalSummary,
  type BoardCardLayout,
  type BoardConnectorLayout,
  type BuiltInAgentSkill,
  type CollabProjectDocument,
} from "../collab/portableInstrumentsSchema";
import { drawPortableInstrumentToCanvasIr } from "../instruments/instrumentCanvasRenderer";
import {
  PORTABLE_INSTRUMENTS,
  getPortableInstrument,
} from "../instruments/instrumentProfiles";
import { formatWrittenPitch } from "../score-editor/EditableArrangement";
import { CANONICAL_PPQ, type EditableArrangement } from "../score-editor/editorTypes";

export interface InfiniteCanvasBoardProps {
  collabDoc: CollabProjectDocument;
  arrangement: EditableArrangement;
  selectedEventIds: string[];
  playheadBeat?: number;
  dark?: boolean;
  onSelectEvent: (eventId: string) => void;
  onDragPitchDiatonically: (eventId: string, deltaSteps: number) => void;
  onSyncFromCollab: () => void;
  onPlayAudition: () => void;
  onOpenInSongPractice: () => void;
}

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";
const TITLE_BAR_H = 34;

export function InfiniteCanvasBoard({
  collabDoc,
  arrangement,
  selectedEventIds,
  playheadBeat,
  dark = false,
  onSelectEvent,
  onDragPitchDiatonically,
  onSyncFromCollab,
  onPlayAudition,
  onOpenInSongPractice,
}: InfiniteCanvasBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState({ x: 20, y: 10, zoom: 1 });
  const [showArtifactInspector, setShowArtifactInspector] = useState(false);
  const [artifactDraft, setArtifactDraft] = useState(() => collabDoc.toTaggedSource());
  const [artifactError, setArtifactError] = useState("");
  const [, setTick] = useState(0);

  const decoded = collabDoc.getDecodedState();
  const activeInstrument = getPortableInstrument(decoded.activeInstrument);
  const pendingProposal: AgentArtifactProposalSummary | undefined = collabDoc.pendingAgentProposal;

  const selectedEvent =
    arrangement.events.find((e) => e.id === selectedEventIds[0]) ?? arrangement.events[0];

  // Keep artifact draft synchronized when not actively editing
  useEffect(() => {
    setArtifactDraft(collabDoc.toTaggedSource());
  }, [collabDoc, arrangement, decoded.activeInstrument]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = Math.max(640, container.clientWidth || 1100);
    const height = Math.max(540, container.clientHeight || 660);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Record the entire board into a CanvasIR RecordingContext
    const rec = new RecordingContext();
    const bgCol = dark ? "#1b1c1b" : "#f6f4ef";
    const cardBg = dark ? "#242624" : "#fffdf9";
    const headerBg = dark ? "#2c2f2c" : "#f0eee8";
    const borderCol = dark ? "#7a7f77" : "#8a8e88";
    const subtleBorder = dark ? "#454943" : "#d9d7d0";
    const textCol = dark ? "#f4f2ec" : "#252725";
    const mutedCol = dark ? "#afb1aa" : "#676c67";
    const accentCol = dark ? "#9bc7ff" : "#1b5293";

    // Subtle dot grid on the infinite surface
    rec.beginGroup({ id: "board-grid", meta: { hit: false, snap: false } });
    rec.fillStyle = subtleBorder;
    for (let gx = -200; gx <= 1600; gx += 40) {
      for (let gy = -100; gy <= 900; gy += 40) {
        rec.fillRect(gx, gy, 2, 2);
      }
    }
    rec.endGroup();

    const cardsById = new Map<string, BoardCardLayout>(decoded.cards.map((c) => [c.id, c]));

    // 1. Draw live edge-to-edge Connectors between cards
    for (const conn of decoded.connectors) {
      const fromCard = cardsById.get(conn.from);
      const toCard = cardsById.get(conn.to);
      if (!fromCard || !toCard) continue;
      drawConnectorArrow(rec, conn, fromCard, toCard, accentCol, mutedCol);
    }

    // 2. Draw each Card on the board
    for (const card of decoded.cards) {
      rec.beginGroup({
        id: card.id,
        meta: {
          role: "region",
          label: `${card.title} card`,
          cardId: card.id,
          cardKind: card.kind,
        },
      });

      // Card body shadow & frame
      rec.beginPath();
      rec.roundRect(card.x, card.y, card.w, card.h, 14);
      rec.fillStyle = cardBg;
      rec.fill();
      rec.strokeStyle = borderCol;
      rec.lineWidth = 1.5;
      rec.stroke();

      // Title bar (drag handle)
      rec.beginGroup({
        id: `${card.id}/titlebar`,
        meta: {
          role: "button",
          label: `Drag ${card.title}`,
          cardDragId: card.id,
        },
      });
      rec.beginPath();
      rec.roundRect(card.x + 1, card.y + 1, card.w - 2, TITLE_BAR_H, [13, 13, 0, 0]);
      rec.fillStyle = headerBg;
      rec.fill();
      rec.fillStyle = subtleBorder;
      rec.fillRect(card.x + 1, card.y + TITLE_BAR_H, card.w - 2, 1);

      rec.font = `700 13px ${FONT}`;
      rec.fillStyle = textCol;
      rec.textAlign = "left";
      rec.fillText(`❖ ${card.title}`, card.x + 14, card.y + 22);
      rec.font = `600 10px ${FONT}`;
      rec.fillStyle = mutedCol;
      rec.textAlign = "right";
      rec.fillText(`(${Math.round(card.x)}, ${Math.round(card.y)})`, card.x + card.w - 12, card.y + 21);
      rec.endGroup();

      const contentX = card.x + 14;
      const contentY = card.y + TITLE_BAR_H + 12;
      const contentW = card.w - 28;
      const contentH = card.h - TITLE_BAR_H - 22;

      if (card.kind === "source") {
        const src = collabDoc.sourceProject;
        rec.font = `700 13px ${FONT}`;
        rec.fillStyle = textCol;
        rec.textAlign = "left";
        rec.fillText(src.provenance.fileName, contentX, contentY + 14);

        rec.font = `500 11px ${FONT}`;
        rec.fillStyle = mutedCol;
        rec.fillText(
          `${src.sourceSummary.format} · SHA-256 ${src.provenance.sha256.slice(0, 12)}…`,
          contentX,
          contentY + 32,
        );
        rec.fillText(
          `Candidate: ${collabDoc.sourceCandidateId.slice(0, 28)}`,
          contentX,
          contentY + 48,
        );

        // Track inventory mini-pills
        src.sourceSummary.inventory.slice(0, 4).forEach((inv, idx) => {
          const py = contentY + 64 + idx * 34;
          rec.beginPath();
          rec.roundRect(contentX, py, contentW, 28, 7);
          rec.fillStyle = headerBg;
          rec.fill();
          rec.strokeStyle = subtleBorder;
          rec.lineWidth = 1;
          rec.stroke();

          rec.font = `700 11px ${FONT}`;
          rec.fillStyle = textCol;
          rec.fillText(inv.label.slice(0, 26), contentX + 8, py + 18);
          rec.font = `600 10px ${FONT}`;
          rec.fillStyle = mutedCol;
          rec.textAlign = "right";
          rec.fillText(
            `${inv.noteCount}n · MIDI ${inv.minMidi}–${inv.maxMidi}`,
            contentX + contentW - 8,
            py + 18,
          );
          rec.textAlign = "left";
        });
      } else if (card.kind === "score") {
        drawScoreAndTimingCard(
          rec,
          arrangement,
          pendingProposal,
          selectedEventIds,
          playheadBeat,
          contentX,
          contentY,
          contentW,
          contentH,
          dark,
        );
      } else if (card.kind === "instrument") {
        drawPortableInstrumentToCanvasIr(rec, {
          profile: activeInstrument,
          x: card.x + 8,
          y: card.y + TITLE_BAR_H + 4,
          width: card.w - 16,
          height: card.h - TITLE_BAR_H - 12,
          targetMidi: selectedEvent?.midi,
          dark,
        });
      } else if (card.kind === "lyrics") {
        // Render rich text lyrics using @canvas-ir/text (Pretext line-breaking engine)
        const blocks = [
          {
            type: "heading" as const,
            level: 3 as const,
            content: [`Lyrics · ${arrangement.title}`],
          },
          ...decoded.lyrics.map((line) => ({
            type: "paragraph" as const,
            content: [line],
          })),
          {
            type: "paragraph" as const,
            content: [
              {
                text: "Tip: Use the Agent Dock below to refine lyrics or simplify leaps via ml-collab-codec.",
                italic: true,
              },
            ],
          },
        ];
        try {
          const layout = layoutText(
            { blocks },
            {
              container: { x: contentX, y: contentY, width: contentW },
              theme: {
                fontFamily: FONT,
                fontSize: 13,
                color: textCol,
              },
            },
          );
          drawTextLayout(rec, layout);
        } catch {
          // Fallback if OffscreenCanvas font metrics unavailable in headless env
          rec.font = `600 12px ${FONT}`;
          rec.fillStyle = textCol;
          rec.textAlign = "left";
          decoded.lyrics.forEach((line, idx) => {
            rec.fillText(line, contentX, contentY + 20 + idx * 22);
          });
        }
      }

      rec.endGroup();
    }

    const scene = new Scene(rec.getDocument());
    const viewMatrix = {
      a: camera.zoom * dpr,
      b: 0,
      c: 0,
      d: camera.zoom * dpr,
      e: camera.x * dpr,
      f: camera.y * dpr,
    };
    const cssViewMatrix = {
      a: camera.zoom,
      b: 0,
      c: 0,
      d: camera.zoom,
      e: camera.x,
      f: camera.y,
    };

    const ctx2d = canvas.getContext("2d");
    if (ctx2d) {
      const renderer = new Renderer(scene, ctx2d, { background: bgCol });
      renderer.setView(viewMatrix, canvas.width, canvas.height);
      renderer.render();
    }

    // Build DOM Accessibility Mirror over the canvas via CanvasIR AccessibilityLayer
    const a11y = new AccessibilityLayer(scene, container);
    a11y.setView(cssViewMatrix);
    a11y.update();

    const router = new EventRouter(scene, { view: cssViewMatrix });
    let dragState:
      | { kind: "card"; cardId: string; startWorldX: number; startWorldY: number; origX: number; origY: number }
      | { kind: "note"; eventId: string; startClientY: number }
      | { kind: "pan"; startClientX: number; startClientY: number; origCamX: number; origCamY: number }
      | null = null;

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      return {
        x: (sx - camera.x) / camera.zoom,
        y: (sy - camera.y) / camera.zoom,
        sx,
        sy,
      };
    };

    const onPointerDown = (e: PointerEvent) => {
      const pt = toWorld(e.clientX, e.clientY);
      router.pointerDown({ x: pt.sx, y: pt.sy });
      const hits = scene.hitTest({ x: pt.x, y: pt.y });

      // Check if user hit a note on the canvas score or timing lane
      for (const h of hits) {
        for (const gId of h.groups) {
          if (gId.startsWith("canvas-note:")) {
            const evId = gId.slice("canvas-note:".length);
            onSelectEvent(evId);
            canvas.setPointerCapture(e.pointerId);
            dragState = { kind: "note", eventId: evId, startClientY: e.clientY };
            return;
          }
          if (gId.endsWith("/titlebar")) {
            const cardId = gId.replace("/titlebar", "");
            const card = cardsById.get(cardId);
            if (card) {
              canvas.setPointerCapture(e.pointerId);
              dragState = {
                kind: "card",
                cardId,
                startWorldX: pt.x,
                startWorldY: pt.y,
                origX: card.x,
                origY: card.y,
              };
              return;
            }
          }
        }
      }

      // Otherwise pan the infinite board
      canvas.setPointerCapture(e.pointerId);
      dragState = {
        kind: "pan",
        startClientX: e.clientX,
        startClientY: e.clientY,
        origCamX: camera.x,
        origCamY: camera.y,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const pt = toWorld(e.clientX, e.clientY);
      router.pointerMove({ x: pt.sx, y: pt.sy });
      if (!dragState) return;

      if (dragState.kind === "pan") {
        const panDrag = dragState;
        setCamera((prev) => ({
          ...prev,
          x: panDrag.origCamX + (e.clientX - panDrag.startClientX),
          y: panDrag.origCamY + (e.clientY - panDrag.startClientY),
        }));
      } else if (dragState.kind === "card") {
        const nx = dragState.origX + (pt.x - dragState.startWorldX);
        const ny = dragState.origY + (pt.y - dragState.startWorldY);
        collabDoc.moveBoardCard(dragState.cardId, nx, ny);
        setTick((t) => t + 1);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const pt = toWorld(e.clientX, e.clientY);
      router.pointerUp({ x: pt.sx, y: pt.sy });
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (dragState?.kind === "note") {
        const dy = dragState.startClientY - e.clientY;
        const deltaSteps = Math.round(dy / 6);
        if (deltaSteps !== 0) {
          onDragPitchDiatonically(dragState.eventId, deltaSteps);
        }
      }
      dragState = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setCamera((prev) => {
        const nextZoom = Math.max(0.45, Math.min(2.4, Math.round(prev.zoom * factor * 100) / 100));
        return { ...prev, zoom: nextZoom };
      });
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      a11y.dispose();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [
    collabDoc,
    arrangement,
    selectedEventIds,
    playheadBeat,
    dark,
    camera,
    decoded.activeInstrument,
    pendingProposal,
  ]);

  const triggerAgentSkill = (skill: BuiltInAgentSkill) => {
    setArtifactError("");
    collabDoc.proposeAgentSkill(skill, selectedEventIds, {
      minMidi: activeInstrument.minMidi,
      maxMidi: activeInstrument.maxMidi,
    });
    setTick((t) => t + 1);
  };

  return (
    <section className="infinite-canvas-workspace" aria-label="CanvasIR 2D Workspace">
      {/* Floating HUD Top Bar over the zoomable CanvasIR board */}
      <div className="canvas-hud-topbar">
        <div className="hud-cluster">
          <span className="hud-badge">CanvasIR 2D + ml-collab-codec</span>
          <label className="hud-instrument-picker">
            <span>Instrument</span>
            <select
              aria-label="Canvas active instrument"
              value={activeInstrument.id}
              onChange={(e) => {
                collabDoc.setActiveInstrument(e.target.value);
                setTick((t) => t + 1);
              }}
            >
              {PORTABLE_INSTRUMENTS.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="hud-cluster" role="group" aria-label="Camera presets">
          <button
            type="button"
            onClick={() => setCamera({ x: 20, y: 10, zoom: 1 })}
          >
            Overview (100%)
          </button>
          <button
            type="button"
            onClick={() => setCamera({ x: -370, y: -15, zoom: 1.25 })}
          >
            Focus Score
          </button>
          <button
            type="button"
            onClick={() => setCamera({ x: -370, y: -330, zoom: 1.25 })}
          >
            Focus Instrument
          </button>
          <button
            type="button"
            onClick={() =>
              setCamera((c) => ({ ...c, zoom: Math.min(2.4, Math.round((c.zoom + 0.15) * 100) / 100) }))
            }
            aria-label="Zoom in canvas"
          >
            +
          </button>
          <button
            type="button"
            onClick={() =>
              setCamera((c) => ({ ...c, zoom: Math.max(0.45, Math.round((c.zoom - 0.15) * 100) / 100) }))
            }
            aria-label="Zoom out canvas"
          >
            −
          </button>
        </div>

        <div className="hud-cluster">
          <button type="button" className="listen" onClick={onPlayAudition}>
            ▶ Audition
          </button>
          <button
            type="button"
            aria-pressed={showArtifactInspector}
            className={showArtifactInspector ? "active" : ""}
            onClick={() => setShowArtifactInspector((v) => !v)}
          >
            {showArtifactInspector ? "Hide <project> Artifact" : "Inspect <project> Artifact"}
          </button>
          <button type="button" className="primary" onClick={onOpenInSongPractice}>
            Open in Practice →
          </button>
        </div>
      </div>

      {/* Main Zoomable CanvasIR Board */}
      <div className="canvas-ir-stage-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          data-testid="canvas-ir-board"
          aria-label="Interactive 2D music desktop canvas"
        />

        {/* Tagged Artifact Inspector Drawer (`ml-collab-codec` readable tagged source <-> JSON) */}
        {showArtifactInspector && (
          <aside className="collab-artifact-drawer" aria-label="ml-collab-codec tagged artifact">
            <div className="artifact-drawer-header">
              <div>
                <span className="eyebrow">ML-COLLAB-CODEC ARTIFACT · REV {collabDoc.revision}</span>
                <h3>Readable Tagged Source (&lt;project&gt;)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowArtifactInspector(false)}
              >
                Close
              </button>
            </div>
            <p className="artifact-hint">
              Human and agent read and edit the same schema-validated artifact. Edits compute an
              identity-aware diff via <code>proposeEdit()</code> and rebase via OT{" "}
              <code>rebaseProposal()</code>.
            </p>
            {artifactError && (
              <p role="alert" className="import-error">
                {artifactError}
              </p>
            )}
            <textarea
              aria-label="Tagged project artifact source"
              className="artifact-source-textarea"
              value={artifactDraft}
              onChange={(e) => setArtifactDraft(e.target.value)}
            />
            <div className="toolbar-btn-row">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  try {
                    setArtifactError("");
                    collabDoc.proposeAgentEditFromTaggedSource(
                      artifactDraft,
                      "Direct tagged artifact edit",
                      "Proposed from edited <project> tagged source.",
                    );
                    setTick((t) => t + 1);
                  } catch (err) {
                    setArtifactError(err instanceof Error ? err.message : String(err));
                  }
                }}
              >
                Propose Artifact Diff (proposeEdit)
              </button>
              <button
                type="button"
                onClick={() => setArtifactDraft(collabDoc.toTaggedSource())}
              >
                Reset to current revision
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Persistent Contextual Agent Dock at bottom of workspace */}
      <section className="canvas-agent-dock" aria-label="Contextual agent dock">
        <div className="agent-dock-prompt-row">
          <span className="agent-status-dot" />
          <b>Agent (ml-collab-codec artifact mode):</b>
          <span className="agent-context-summary">
            Active instrument: <b>{activeInstrument.shortName}</b> · Target:{" "}
            <b>
              {selectedEvent
                ? `${selectedEvent.kind === "note" ? formatWrittenPitch(selectedEvent.writtenPitch, selectedEvent.midi) : "Rest"}`
                : "Full arrangement"}
            </b>
          </span>
          <div className="agent-skill-buttons" role="group" aria-label="Agent artifact actions">
            <button
              type="button"
              onClick={() => triggerAgentSkill("fit-instrument-range")}
            >
              ★ Fit to {activeInstrument.shortName} range
            </button>
            <button
              type="button"
              onClick={() => triggerAgentSkill("simplify-melody")}
            >
              ★ Simplify wide leaps
            </button>
            <button
              type="button"
              onClick={() => triggerAgentSkill("transpose-up-2")}
            >
              ★ Transpose +2 semitones
            </button>
            <button
              type="button"
              onClick={() => triggerAgentSkill("humanize-lyrics")}
            >
              ★ Refine B1 lyrics
            </button>
          </div>
        </div>

        {pendingProposal && (
          <div className="agent-proposal-banner" data-testid="agent-proposal-banner">
            <div className="proposal-copy">
              <b>Pending Proposal: {pendingProposal.title}</b>
              <span>
                {pendingProposal.rationale} ({pendingProposal.proposal.changes.length} OT change
                primitive(s) · {pendingProposal.changedEventIds.length} note(s) affected; shown as
                ghost diff on canvas)
              </span>
            </div>
            <div className="proposal-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  collabDoc.applyPendingProposal();
                  onSyncFromCollab();
                  setTick((t) => t + 1);
                }}
              >
                ✓ Apply Proposal (rebaseProposal)
              </button>
              <button
                type="button"
                onClick={() => {
                  collabDoc.rejectPendingProposal();
                  setTick((t) => t + 1);
                }}
              >
                ✕ Reject
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function drawConnectorArrow(
  ctx: RecordingContext,
  conn: BoardConnectorLayout,
  from: BoardCardLayout,
  to: BoardCardLayout,
  accentCol: string,
  mutedCol: string,
) {
  ctx.beginGroup({
    id: conn.id,
    meta: { role: "img", label: `Connector ${conn.label}`, from: conn.from, to: conn.to },
  });

  const fromCx = from.x + from.w / 2;
  const fromCy = from.y + from.h / 2;
  const toCx = to.x + to.w / 2;
  const toCy = to.y + to.h / 2;

  let x1 = fromCx;
  let y1 = fromCy;
  let x2 = toCx;
  let y2 = toCy;

  if (Math.abs(toCx - fromCx) > Math.abs(toCy - fromCy)) {
    x1 = toCx > fromCx ? from.x + from.w : from.x;
    x2 = toCx > fromCx ? to.x : to.x + to.w;
  } else {
    y1 = toCy > fromCy ? from.y + from.h : from.y;
    y2 = toCy > fromCy ? to.y : to.y + to.h;
  }

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(midX, y1, x2, y2);
  ctx.strokeStyle = accentCol;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowhead at (x2, y2)
  const angle = Math.atan2(y2 - y1, x2 - midX);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 9 * Math.cos(angle - 0.4), y2 - 9 * Math.sin(angle - 0.4));
  ctx.lineTo(x2 - 9 * Math.cos(angle + 0.4), y2 - 9 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fillStyle = accentCol;
  ctx.fill();

  if (conn.label) {
    ctx.font = `600 10px ${FONT}`;
    ctx.fillStyle = mutedCol;
    ctx.textAlign = "center";
    ctx.fillText(conn.label, midX, midY - 6);
  }
  ctx.endGroup();
}

function drawScoreAndTimingCard(
  ctx: RecordingContext,
  arrangement: EditableArrangement,
  pendingProposal: AgentArtifactProposalSummary | undefined,
  selectedEventIds: string[],
  playheadBeat: number | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  dark: boolean,
) {
  const staffTop = y + 26;
  const lineGap = 11;
  const staffHeight = lineGap * 4;
  const lineCol = dark ? "#7a7f77" : "#8a8e88";
  const textCol = dark ? "#f4f2ec" : "#252725";
  const accentCol = dark ? "#9bc7ff" : "#1b5293";
  const proposalCol = "#16a34a";

  // 5 staff lines
  ctx.strokeStyle = lineCol;
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const ly = staffTop + i * lineGap;
    ctx.beginPath();
    ctx.moveTo(x, ly);
    ctx.lineTo(x + w, ly);
    ctx.stroke();
  }

  // Clef & meter header
  ctx.font = `700 22px Georgia, serif`;
  ctx.fillStyle = textCol;
  ctx.textAlign = "left";
  ctx.fillText("G", x + 10, staffTop + 31);
  ctx.font = `800 14px ${FONT}`;
  ctx.fillText(String(arrangement.meter.numerator), x + 36, staffTop + 17);
  ctx.fillText(String(arrangement.meter.denominator), x + 36, staffTop + 36);

  const totalTicks = Math.max(
    CANONICAL_PPQ * 4,
    arrangement.events.reduce((m, e) => Math.max(m, e.startTick + e.durationTick), 0),
  );
  const notesStartX = x + 62;
  const notesSpanW = Math.max(200, w - 76);
  const tickToX = (tick: number) => notesStartX + (tick / totalTicks) * notesSpanW;

  // Pitch Y mapping: E4 (MIDI 64) is bottom staff line (staffTop + 4*lineGap)
  const midiToY = (midi: number) => {
    const semitonesFromE4 = midi - 64;
    const diatonicApprox = semitonesFromE4 * (7 / 12);
    return staffTop + staffHeight - diatonicApprox * (lineGap / 2);
  };

  const selectedSet = new Set(selectedEventIds);
  const proposalById = new Map(
    pendingProposal?.previewArrangement.events.map((e) => [e.id, e]) ?? [],
  );

  // Timing lane strip below staff
  const laneTop = staffTop + staffHeight + 48;
  const laneH = Math.max(38, h - (laneTop - y) - 8);
  ctx.beginPath();
  ctx.roundRect(x, laneTop, w, laneH, 8);
  ctx.fillStyle = dark ? "#1b1c1b" : "#f0eee8";
  ctx.fill();

  for (const ev of arrangement.events) {
    const nx = tickToX(ev.startTick);
    const nw = Math.max(18, tickToX(ev.startTick + ev.durationTick) - nx - 3);
    const isSelected = selectedSet.has(ev.id);
    const proposedEv = proposalById.get(ev.id);
    const hasProposalDiff =
      proposedEv &&
      (proposedEv.midi !== ev.midi || proposedEv.durationTick !== ev.durationTick);

    ctx.beginGroup({
      id: `canvas-note:${ev.id}`,
      meta: {
        role: "button",
        label: `${ev.kind === "note" ? formatWrittenPitch(ev.writtenPitch, ev.midi) : "Rest"} (${ev.durationTick} ticks)`,
        eventId: ev.id,
      },
    });

    if (ev.kind === "note" && ev.midi !== undefined) {
      const ny = midiToY(ev.midi);

      // Duration ribbon behind notehead on staff
      ctx.beginPath();
      ctx.roundRect(nx + 6, ny - 3, Math.max(8, nw - 6), 6, 3);
      ctx.fillStyle = isSelected ? accentCol : dark ? "#334155" : "#cbd5e1";
      ctx.fill();

      // If agent proposed a pitch change, draw current note as ghost outline and proposed note in green!
      if (hasProposalDiff && proposedEv?.midi !== undefined) {
        ctx.beginPath();
        ctx.ellipse(nx + 7, ny, 7, 5, -0.25, 0, Math.PI * 2);
        ctx.strokeStyle = textCol;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const py = midiToY(proposedEv.midi);
        ctx.beginPath();
        ctx.ellipse(nx + 7, py, 8, 5.5, -0.25, 0, Math.PI * 2);
        ctx.fillStyle = proposalCol;
        ctx.fill();

        ctx.font = `700 10px ${FONT}`;
        ctx.fillStyle = proposalCol;
        ctx.textAlign = "center";
        ctx.fillText(
          `→${formatWrittenPitch(proposedEv.writtenPitch, proposedEv.midi)}`,
          nx + 10,
          py - 10,
        );
      } else {
        // Standard notehead + stem
        ctx.beginPath();
        ctx.ellipse(nx + 7, ny, 7.5, 5.5, -0.25, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? accentCol : textCol;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(nx + 13.5, ny);
        ctx.lineTo(nx + 13.5, ny - 26);
        ctx.strokeStyle = isSelected ? accentCol : textCol;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      ctx.font = `700 10px ${FONT}`;
      ctx.fillStyle = isSelected ? accentCol : textCol;
      ctx.textAlign = "center";
      ctx.fillText(
        formatWrittenPitch(ev.writtenPitch, ev.midi),
        nx + 8,
        staffTop + staffHeight + 24,
      );
    } else {
      // Rest marker on staff
      const ry = staffTop + staffHeight / 2;
      ctx.fillStyle = isSelected ? accentCol : lineCol;
      ctx.fillRect(nx + 4, ry - 4, 10, 8);
    }

    // Synchronized block in Timing Lane
    ctx.beginPath();
    ctx.roundRect(nx, laneTop + 6, nw, laneH - 12, 5);
    ctx.fillStyle = isSelected
      ? dark
        ? "#1e3a8a"
        : "#dce9ff"
      : ev.kind === "rest"
        ? dark
          ? "#262626"
          : "#e5e5e0"
        : dark
          ? "#333633"
          : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = hasProposalDiff ? proposalCol : isSelected ? accentCol : lineCol;
    ctx.lineWidth = isSelected || hasProposalDiff ? 2 : 1;
    ctx.stroke();

    ctx.font = `700 10px ${FONT}`;
    ctx.fillStyle = textCol;
    ctx.textAlign = "left";
    const blockLabel =
      ev.kind === "note" ? formatWrittenPitch(ev.writtenPitch, ev.midi) : "Rest";
    ctx.fillText(blockLabel, nx + 5, laneTop + laneH / 2 + 3);

    ctx.endGroup();
  }

  // Playhead across both staff and timing lane
  if (playheadBeat !== undefined) {
    const px = tickToX(playheadBeat * CANONICAL_PPQ);
    ctx.beginPath();
    ctx.moveTo(px, staffTop - 8);
    ctx.lineTo(px, laneTop + laneH);
    ctx.strokeStyle = accentCol;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
