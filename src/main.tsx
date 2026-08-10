import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { CalibrationLab, FixtureRecorder, PitchLab, TimingLab } from "./labs/Labs";
import "./styles.css";

const lab = new URLSearchParams(location.search).get("lab");
const content = lab === "pitch" ? <PitchLab/> : lab === "fixtures" ? <FixtureRecorder/> : lab === "timing" ? <TimingLab/> : lab === "calibration" ? <CalibrationLab/> : <App/>;
createRoot(document.getElementById("root")!).render(<StrictMode>{content}</StrictMode>);
