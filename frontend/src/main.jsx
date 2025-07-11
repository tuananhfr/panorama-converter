import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SkyBox from "./SkyBox";
//import PanoramaStitcher from "./PanoramaStitcher";
import Panorama360Creator from "./Panorama360Creator";
import PanoramaViewer from "./PanoramaViewer";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* <SkyBox /> */}
    {/* <PanoramaStitcher /> */}
    {/* <Panorama360Creator /> */}
    <PanoramaViewer />
  </StrictMode>
);
