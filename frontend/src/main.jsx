import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import DualPanoramaViewer from "./DualPanoramaViewer";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "bootstrap-icons/font/bootstrap-icons.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DualPanoramaViewer />
  </StrictMode>
);
