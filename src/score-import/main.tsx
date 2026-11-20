import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles.css";
import { ScoreImportWorkbench } from "./ScoreImportWorkbench";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScoreImportWorkbench />
  </StrictMode>,
);
