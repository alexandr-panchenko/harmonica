import type { RecordingContext } from "../vendor/canvas-ir/index";
import { noteName } from "../music/pitch";
import type { PortableInstrumentProfile } from "./instrumentProfiles";

export interface InstrumentDrawOptions {
  profile: PortableInstrumentProfile;
  x: number;
  y: number;
  width: number;
  height: number;
  targetMidi?: number;
  detectedMidis?: number[];
  scalePitchClasses?: Set<number>;
  tonicPitchClass?: number;
  centsDeviation?: number;
  dark?: boolean;
}

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";

export function drawPortableInstrumentToCanvasIr(
  ctx: RecordingContext,
  opts: InstrumentDrawOptions,
): void {
  const {
    profile,
    x,
    y,
    width,
    height,
    targetMidi,
    detectedMidis = [],
    scalePitchClasses,
    tonicPitchClass,
    centsDeviation = 0,
    dark = false,
  } = opts;

  const detectedSet = new Set(detectedMidis.map((m) => Math.round(m)));
  const surfaceBg = dark ? "#242624" : "#fffdf9";
  const panelBg = dark ? "#2c2f2c" : "#f0eee8";
  const borderCol = dark ? "#7a7f77" : "#8a8e88";
  const textCol = dark ? "#f4f2ec" : "#252725";
  const mutedCol = dark ? "#afb1aa" : "#676c67";
  const accentCol = dark ? "#9bc7ff" : "#1b5293";
  const targetFill = dark ? "#1d4ed8" : "#dce9ff";
  const detectedFill = dark ? "#15803d" : "#bbf7d0";
  const scaleFill = dark ? "#443247" : "#f3e8ff";

  ctx.save();
  ctx.beginGroup({
    id: `instrument-surface-${profile.id}`,
    meta: { role: "region", label: profile.name, instrumentId: profile.id },
  });

  if (profile.family === "harmonica") {
    const holeCount = profile.id === "harmonica-c10" ? 10 : 12;
    const padX = 24;
    const bodyW = width - padX * 2 - 28;
    const bodyH = Math.min(116, height - 44);
    const bodyX = x + padX;
    const bodyY = y + 18;

    // Cover plate
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 16);
    ctx.fillStyle = dark ? "#475569" : "#cbd5e1";
    ctx.fill();
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Slider button at right
    const targetPlacements = targetMidi !== undefined ? profile.placementsForPitch(targetMidi) : [];
    const slideIn =
      targetPlacements.length > 0 && targetPlacements.every((p) => p.slide === "in");
    const slideX = bodyX + bodyW - (slideIn ? 8 : 0);
    ctx.beginGroup({
      id: "harmonica-slider",
      meta: { role: "status", label: slideIn ? "Slide in" : "Slide out" },
    });
    ctx.beginPath();
    ctx.roundRect(slideX, bodyY + bodyH * 0.35, 26, 28, 8);
    ctx.fillStyle = slideIn ? accentCol : dark ? "#94a3b8" : "#e2e8f0";
    ctx.fill();
    ctx.strokeStyle = borderCol;
    ctx.stroke();
    ctx.endGroup();

    const holeW = (bodyW - 24) / holeCount;
    const allActions = profile.allPlacements();

    for (let h = 1; h <= holeCount; h++) {
      const hx = bodyX + 12 + (h - 1) * holeW;
      const hy = bodyY + 22;
      const hw = holeW - 6;
      const hh = bodyH - 34;
      const holeActions = allActions.filter((a) => a.hole === h);
      const isTarget = targetMidi !== undefined && holeActions.some((a) => a.pitchMidi === targetMidi);
      const isDetected = holeActions.some((a) => detectedSet.has(a.pitchMidi));
      const inScale =
        scalePitchClasses && holeActions.some((a) => scalePitchClasses.has(a.pitchMidi % 12));

      ctx.beginGroup({
        id: `hole-${h}`,
        meta: {
          role: "button",
          label: `Harmonica hole ${h}`,
          hole: h,
          pitchMidi: holeActions[0]?.pitchMidi ?? 60,
        },
      });
      ctx.beginPath();
      ctx.roundRect(hx, hy, hw, hh, 6);
      ctx.fillStyle = isDetected
        ? detectedFill
        : isTarget
          ? targetFill
          : inScale
            ? scaleFill
            : dark
              ? "#182522"
              : "#1e293b";
      ctx.fill();
      ctx.strokeStyle = isTarget ? accentCol : borderCol;
      ctx.lineWidth = isTarget ? 2.5 : 1;
      ctx.stroke();

      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = textCol;
      ctx.textAlign = "center";
      ctx.fillText(String(h), hx + hw / 2, bodyY + 14);

      // Show blow/draw pitch inside hole
      const match =
        holeActions.find((a) => a.pitchMidi === targetMidi) ??
        holeActions.find((a) => detectedSet.has(a.pitchMidi)) ??
        holeActions[0];
      if (match) {
        ctx.font = `700 10px ${FONT}`;
        ctx.fillStyle = isTarget || isDetected || inScale ? (dark ? "#fff" : "#0f172a") : "#e2e8f0";
        ctx.fillText(noteName(match.pitchMidi), hx + hw / 2, hy + hh / 2 - 4);
        ctx.font = `600 9px ${FONT}`;
        ctx.fillText(
          `${match.breath === "blow" ? "↑" : "↓"}${match.slide === "in" ? "+S" : ""}`,
          hx + hw / 2,
          hy + hh / 2 + 10,
        );
      }
      ctx.endGroup();
    }
  } else if (profile.family === "kalimba") {
    // 17 alternating metal tines radiating from top bridge
    const tines = profile.allPlacements();
    const padX = 22;
    const tineGap = (width - padX * 2) / tines.length;
    const bridgeY = y + 16;

    // Wooden soundboard & top metal bridge bar
    ctx.beginPath();
    ctx.roundRect(x + 12, y + 8, width - 24, height - 20, 14);
    ctx.fillStyle = dark ? "#2d261e" : "#f5ebe0";
    ctx.fill();
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = dark ? "#64748b" : "#94a3b8";
    ctx.fillRect(x + 18, bridgeY, width - 36, 8);

    for (let i = 0; i < tines.length; i++) {
      const t = tines[i]!;
      const tx = x + padX + i * tineGap + 2;
      const tw = Math.max(14, tineGap - 5);
      // Center tine is longest; outer tines are progressively shorter!
      const rank = t.rankFromCenter ?? 0;
      const maxLen = height - 48;
      const th = Math.max(54, maxLen - rank * 7.5);
      const isTarget = targetMidi !== undefined && t.pitchMidi === Math.round(targetMidi);
      const isDetected = detectedSet.has(t.pitchMidi);
      const isTonic = tonicPitchClass !== undefined && t.pitchMidi % 12 === tonicPitchClass;
      const inScale = scalePitchClasses?.has(t.pitchMidi % 12) ?? false;

      ctx.beginGroup({
        id: t.id,
        meta: {
          role: "button",
          label: t.label,
          pitchMidi: t.pitchMidi,
          tineIndex: i,
        },
      });
      ctx.beginPath();
      ctx.roundRect(tx, bridgeY + 6, tw, th, [2, 2, 8, 8]);
      ctx.fillStyle = isDetected
        ? detectedFill
        : isTarget
          ? targetFill
          : isTonic
            ? accentCol
            : inScale
              ? scaleFill
              : surfaceBg;
      ctx.fill();
      ctx.strokeStyle = isTarget ? accentCol : borderCol;
      ctx.lineWidth = isTarget ? 2.5 : 1;
      ctx.stroke();

      ctx.font = `700 10px ${FONT}`;
      ctx.fillStyle = isTonic && !isTarget && !isDetected ? "#ffffff" : textCol;
      ctx.textAlign = "center";
      ctx.fillText(noteName(t.pitchMidi), tx + tw / 2, bridgeY + th - 8);
      ctx.endGroup();
    }
  } else if (profile.family === "melodica" || profile.family === "midi-keyboard") {
    // Piano keyboard layout (C3=48 to C6=84 for readable display)
    const dispMin = Math.max(profile.minMidi, 53);
    const dispMax = Math.min(profile.maxMidi, 84);
    const whiteKeys: number[] = [];
    const blackKeys: { midi: number; afterWhiteIdx: number }[] = [];
    for (let m = dispMin; m <= dispMax; m++) {
      const pc = ((m % 12) + 12) % 12;
      if ([1, 3, 6, 8, 10].includes(pc)) {
        blackKeys.push({ midi: m, afterWhiteIdx: Math.max(0, whiteKeys.length - 1) });
      } else {
        whiteKeys.push(m);
      }
    }

    const padX = 18;
    const keyY = y + 18;
    const whiteW = (width - padX * 2) / Math.max(1, whiteKeys.length);
    const whiteH = height - 42;

    whiteKeys.forEach((m, idx) => {
      const kx = x + padX + idx * whiteW;
      const isTarget = targetMidi !== undefined && m === Math.round(targetMidi);
      const isDetected = detectedSet.has(m);
      const inScale = scalePitchClasses?.has(m % 12) ?? false;

      ctx.beginGroup({
        id: `key-${m}`,
        meta: { role: "button", label: `Key ${noteName(m)}`, pitchMidi: m },
      });
      ctx.beginPath();
      ctx.roundRect(kx, keyY, whiteW - 1.5, whiteH, [0, 0, 5, 5]);
      ctx.fillStyle = isDetected
        ? detectedFill
        : isTarget
          ? targetFill
          : inScale
            ? scaleFill
            : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = isTarget ? accentCol : borderCol;
      ctx.lineWidth = isTarget ? 2.2 : 1;
      ctx.stroke();

      if (m % 12 === 0 || isTarget || isDetected) {
        ctx.font = `700 10px ${FONT}`;
        ctx.fillStyle = "#0f172a";
        ctx.textAlign = "center";
        ctx.fillText(noteName(m), kx + whiteW / 2, keyY + whiteH - 10);
      }
      ctx.endGroup();
    });

    const blackW = whiteW * 0.64;
    const blackH = whiteH * 0.6;
    for (const bk of blackKeys) {
      const kx = x + padX + (bk.afterWhiteIdx + 1) * whiteW - blackW / 2;
      const isTarget = targetMidi !== undefined && bk.midi === Math.round(targetMidi);
      const isDetected = detectedSet.has(bk.midi);
      const inScale = scalePitchClasses?.has(bk.midi % 12) ?? false;

      ctx.beginGroup({
        id: `key-${bk.midi}`,
        meta: { role: "button", label: `Key ${noteName(bk.midi)}`, pitchMidi: bk.midi },
      });
      ctx.beginPath();
      ctx.roundRect(kx, keyY, blackW, blackH, [0, 0, 4, 4]);
      ctx.fillStyle = isDetected
        ? "#22c55e"
        : isTarget
          ? "#3b82f6"
          : inScale
            ? "#9333ea"
            : "#1e293b";
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.endGroup();
    }
  } else if (profile.family === "pontic-lyra") {
    // Fretless 3-string diagrammatic fingerboard + separate bow recommendation + honest microphone message
    const boardX = x + 24;
    const boardY = y + 18;
    const boardW = width * 0.58;
    const boardH = height - 48;

    ctx.beginPath();
    ctx.roundRect(boardX, boardY, boardW, boardH, 10);
    ctx.fillStyle = panelBg;
    ctx.fill();
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const stringNames = ["III · A3 (57)", "II · D4 (62)", "I · G4 (67)"];
    const stringOpenMidis = [57, 62, 67];
    const placements = targetMidi !== undefined ? profile.placementsForPitch(targetMidi) : [];

    for (let s = 0; s < 3; s++) {
      const sy = boardY + 26 + s * ((boardH - 44) / 2);
      const sx1 = boardX + 86;
      const sx2 = boardX + boardW - 22;

      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = textCol;
      ctx.textAlign = "left";
      ctx.fillText(stringNames[s]!, boardX + 10, sy + 4);

      // Fretless string line (NO guitar frets!)
      ctx.beginPath();
      ctx.moveTo(sx1, sy);
      ctx.lineTo(sx2, sy);
      ctx.strokeStyle = dark ? "#cbd5e1" : "#475569";
      ctx.lineWidth = 3 - s * 0.5;
      ctx.stroke();

      // Continuous scale markers if scale explorer active
      if (scalePitchClasses) {
        const openM = stringOpenMidis[s]!;
        for (let semi = 0; semi <= 14; semi++) {
          const m = openM + semi;
          if (scalePitchClasses.has(m % 12)) {
            const norm = semi / 14;
            const px = sx1 + norm * (sx2 - sx1);
            ctx.beginPath();
            ctx.arc(px, sy, 5, 0, Math.PI * 2);
            ctx.fillStyle = m % 12 === tonicPitchClass ? accentCol : scaleFill;
            ctx.fill();
          }
        }
      }

      // Target continuous finger region on string
      const match = placements.find((p) => p.stringIndex === s);
      if (match) {
        const px = sx1 + (match.normalizedPosition ?? 0) * (sx2 - sx1);
        const isPrimary = placements[0]?.id === match.id;
        ctx.beginGroup({
          id: match.id,
          meta: {
            role: "button",
            label: match.label,
            pitchMidi: match.pitchMidi,
          },
        });
        ctx.beginPath();
        ctx.arc(px, sy, isPrimary ? 10 : 7, 0, Math.PI * 2);
        ctx.fillStyle = isPrimary ? accentCol : targetFill;
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = `700 10px ${FONT}`;
        ctx.fillStyle = textCol;
        ctx.textAlign = "center";
        ctx.fillText(
          `${noteName(match.pitchMidi)} (${Math.round((match.normalizedPosition ?? 0) * 100)}%)`,
          px,
          sy - 13,
        );
        ctx.endGroup();
      }
    }

    // Separate Bow & Intonation panel on the right
    const infoX = boardX + boardW + 16;
    const infoW = width - (boardW + 56);
    ctx.beginPath();
    ctx.roundRect(infoX, boardY, infoW, boardH, 10);
    ctx.fillStyle = surfaceBg;
    ctx.fill();
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = accentCol;
    ctx.textAlign = "left";
    ctx.fillText("RESEARCH MAPPING · FRETLESS", infoX + 12, boardY + 20);

    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = textCol;
    ctx.fillText(
      `Bow cue: ↓ Down-bow suggested (separate axis)`,
      infoX + 12,
      boardY + 42,
    );
    ctx.fillText(
      `Intonation: ${centsDeviation > 0 ? `+${centsDeviation}` : centsDeviation} cents from ET`,
      infoX + 12,
      boardY + 62,
    );

    ctx.font = `500 11px ${FONT}`;
    ctx.fillStyle = mutedCol;
    ctx.fillText(
      "⚠ Detected pitch does not confirm which string",
      infoX + 12,
      boardY + 86,
    );
    ctx.fillText(
      "or bow stroke was used.",
      infoX + 12,
      boardY + 102,
    );
  }

  ctx.endGroup();
  ctx.restore();
}
