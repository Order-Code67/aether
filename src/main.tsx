import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@/lib/monaco";
import { applyTheme, readStoredTheme } from "@/lib/theme";
import "@/styles/index.css";

// Apply persisted theme before first paint to avoid a dark→light flash.
applyTheme(readStoredTheme());

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
