import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { CalibrationLab, FixtureRecorder, PitchLab, TimingLab } from "./labs/Labs";
import { StaffDesignLab } from "./labs/staff/StaffDesignLab";
import { HarmonicaDesignLab } from "./labs/harmonica/HarmonicaDesignLab";
import "./styles.css";

const lab = new URLSearchParams(location.search).get("lab");
const path = location.pathname.replace(/\/+$/, "");
const content = path.endsWith("/lab/staff-design") ? <StaffDesignLab/>
  : path.endsWith("/lab/harmonica-design") ? <HarmonicaDesignLab/>
  : lab === "pitch" ? <PitchLab/> : lab === "fixtures" ? <FixtureRecorder/> : lab === "timing" ? <TimingLab/> : lab === "calibration" ? <CalibrationLab/> : <App/>;
createRoot(document.getElementById("root")!).render(<StrictMode>{content}</StrictMode>);
