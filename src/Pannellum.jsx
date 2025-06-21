import React, { useState, useRef, useEffect } from "react";

const Pannellum = () => {
  const [panoramaImage, setPanoramaImage] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [extractedFrames, setExtractedFrames] = useState([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [hotspots, setHotspots] = useState([]);
  const [viewerConfig, setViewerConfig] = useState({
    type: "equirectangular",
    autoLoad: true,
    showControls: true,
    compass: true,
    northOffset: 0,
  });

  const videoRef = useRef(null);
  const pannellumContainerRef = useRef(null);
  const extractCanvasRef = useRef(null);
  const pannellumViewerRef = useRef(null);

  // Load Pannellum library
  useEffect(() => {
    // Load Pannellum CSS
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href =
      "https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.6/pannellum.css";
    document.head.appendChild(cssLink);

    // Load Pannellum JS
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.6/pannellum.js";
    script.onload = () => {
      initializePannellum();
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(cssLink);
      document.head.removeChild(script);
    };
  }, []);

  const initializePannellum = () => {
    if (window.pannellum && pannellumContainerRef.current) {
      // Create default panorama
      const defaultPanorama = createDefaultPanorama();

      pannellumViewerRef.current = window.pannellum.viewer(
        pannellumContainerRef.current,
        {
          ...viewerConfig,
          panorama: defaultPanorama,
          hotSpots: hotspots,
          showFullscreenCtrl: true,
          showZoomCtrl: true,
          mouseZoom: true,
          doubleClickZoom: true,
          draggable: true,
          keyboardZoom: true,
        }
      );

      // Add click listener for hotspot creation
      pannellumViewerRef.current.on("click", function (event) {
        if (window.hotspotMode) {
          addHotspot(event.pitch, event.yaw);
        }
      });
    }
  };

  const createDefaultPanorama = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(0.5, "#98FB98");
    gradient.addColorStop(1, "#90EE90");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add grid pattern
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 64) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Add text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px Arial";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 10;
    ctx.fillText(
      "Upload 360° Image or Video",
      canvas.width / 2,
      canvas.height / 2 - 50
    );

    ctx.font = "bold 32px Arial";
    ctx.fillText(
      "Pannellum Viewer Demo",
      canvas.width / 2,
      canvas.height / 2 + 50
    );

    return canvas.toDataURL();
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPanoramaImage(url);
      loadImageToPannellum(url);
    }
  };

  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("video/")) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);

      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.onloadedmetadata = () => {
          setProcessingStep(
            `Video loaded: ${formatTime(videoRef.current.duration)}`
          );
          setTimeout(() => setProcessingStep(""), 3000);
        };
      }
    }
  };

  const loadImageToPannellum = (imageUrl) => {
    if (pannellumViewerRef.current) {
      setIsProcessing(true);
      setProcessingStep("Loading panoramic image...");

      try {
        // Destroy current viewer
        pannellumViewerRef.current.destroy();

        // Create new viewer with the image
        pannellumViewerRef.current = window.pannellum.viewer(
          pannellumContainerRef.current,
          {
            ...viewerConfig,
            panorama: imageUrl,
            hotSpots: hotspots,
          }
        );

        // Re-add click listener
        pannellumViewerRef.current.on("click", function (event) {
          if (window.hotspotMode) {
            addHotspot(event.pitch, event.yaw);
          }
        });

        setProcessingStep("Image loaded successfully!");
        setTimeout(() => setProcessingStep(""), 2000);
      } catch (error) {
        console.error("Error loading image:", error);
        setProcessingStep("Failed to load image");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const extractFrameAtTime = (time) => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      const canvas = extractCanvasRef.current;
      const ctx = canvas.getContext("2d");

      video.currentTime = time;
      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        resolve({
          time,
          dataUrl,
          width: video.videoWidth,
          height: video.videoHeight,
        });
      };
    });
  };

  const extractFramesFromVideo = async () => {
    if (!videoFile || !videoRef.current) return;

    setIsProcessing(true);
    setProcessingStep("Extracting frames from video...");

    try {
      const video = videoRef.current;
      const duration = video.duration;
      const frameCount = 12; // Extract 12 frames
      const frames = [];

      for (let i = 0; i < frameCount; i++) {
        const time = (duration / frameCount) * i + duration / frameCount / 2;
        setProcessingStep(`Extracting frame ${i + 1}/${frameCount}...`);

        const frameData = await extractFrameAtTime(time);
        frames.push({
          ...frameData,
          index: i,
          title: `Frame ${i + 1} (${formatTime(time)})`,
        });
      }

      setExtractedFrames(frames);

      // Load first frame into viewer
      if (frames.length > 0) {
        loadImageToPannellum(frames[0].dataUrl);
        setCurrentFrameIndex(0);
      }

      setProcessingStep(`Successfully extracted ${frameCount} frames!`);
      setTimeout(() => setProcessingStep(""), 3000);
    } catch (error) {
      console.error("Error extracting frames:", error);
      setProcessingStep("Frame extraction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const loadFrame = (index) => {
    if (extractedFrames[index]) {
      loadImageToPannellum(extractedFrames[index].dataUrl);
      setCurrentFrameIndex(index);
    }
  };

  const addHotspot = (pitch, yaw) => {
    const hotspotText = prompt(
      "Enter hotspot description:",
      "Information Point"
    );
    if (hotspotText) {
      const newHotspot = {
        pitch: pitch,
        yaw: yaw,
        type: "info",
        text: hotspotText,
        id: `hotspot_${Date.now()}`,
      };

      setHotspots((prev) => [...prev, newHotspot]);

      if (pannellumViewerRef.current) {
        pannellumViewerRef.current.addHotSpot(newHotspot);
      }
    }

    window.hotspotMode = false;
  };

  const clearHotspots = () => {
    hotspots.forEach((hotspot) => {
      if (pannellumViewerRef.current) {
        pannellumViewerRef.current.removeHotSpot(hotspot.id);
      }
    });
    setHotspots([]);
  };

  const exportConfiguration = () => {
    const config = {
      type: viewerConfig.type,
      panorama: panoramaImage || extractedFrames[currentFrameIndex]?.dataUrl,
      hotSpots: hotspots,
      extractedFrames: extractedFrames,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pannellum-config-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportHTMLViewer = () => {
    const config = {
      type: viewerConfig.type,
      panorama: panoramaImage || extractedFrames[currentFrameIndex]?.dataUrl,
      hotSpots: hotspots,
    };

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>360° Panorama Viewer</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.6/pannellum.css"/>
    <style>
        body { margin: 0; font-family: Arial, sans-serif; }
        #panorama { width: 100vw; height: 100vh; }
        .info { position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="info">
        <h3>360° Panorama Viewer</h3>
        <p>Created with Pannellum</p>
    </div>
    <div id="panorama"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pannellum/2.5.6/pannellum.js"></script>
    <script>
        pannellum.viewer('panorama', ${JSON.stringify(config, null, 2)});
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `panorama-viewer-${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const resetAll = () => {
    setPanoramaImage(null);
    setVideoFile(null);
    setExtractedFrames([]);
    setCurrentFrameIndex(0);
    clearHotspots();
    setProcessingStep("");

    if (videoRef.current) {
      videoRef.current.src = "";
    }

    // Reset to default panorama
    const defaultPanorama = createDefaultPanorama();
    if (pannellumViewerRef.current) {
      try {
        pannellumViewerRef.current.destroy();
        pannellumViewerRef.current = window.pannellum.viewer(
          pannellumContainerRef.current,
          {
            ...viewerConfig,
            panorama: defaultPanorama,
            hotSpots: [],
          }
        );
      } catch (error) {
        console.error("Error resetting viewer:", error);
      }
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <h1 className="text-center mb-4">
            <i className="bi bi-globe me-2"></i>
            Pannellum 360° Viewer
          </h1>
          <p className="text-center text-muted mb-4">
            Upload 360° images or extract frames from video for panoramic
            viewing
          </p>
        </div>
      </div>

      <div className="row">
        {/* Controls Panel */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">
                <i className="bi bi-upload me-2"></i>
                Upload & Controls
              </h5>
            </div>
            <div
              className="card-body"
              style={{ maxHeight: "80vh", overflowY: "auto" }}
            >
              {/* Image Upload */}
              <div className="mb-4">
                <label className="form-label fw-bold">
                  <i className="bi bi-image me-2"></i>
                  Upload 360° Image
                </label>
                <input
                  type="file"
                  className="form-control mb-3"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                <small className="text-muted">
                  Supports: JPG, PNG, WebP - Equirectangular format recommended
                </small>
              </div>

              {/* Video Upload */}
              <div className="mb-4">
                <label className="form-label fw-bold">
                  <i className="bi bi-camera-video me-2"></i>
                  Upload 360° Video
                </label>
                <input
                  type="file"
                  className="form-control mb-3"
                  accept="video/*"
                  onChange={handleVideoUpload}
                />

                {videoFile && (
                  <>
                    <video
                      ref={videoRef}
                      className="w-100 mb-3"
                      style={{ maxHeight: "150px" }}
                      controls
                    />
                    <button
                      className="btn btn-warning w-100"
                      onClick={extractFramesFromVideo}
                      disabled={isProcessing}
                    >
                      <i className="bi bi-scissors me-2"></i>
                      Extract Frames
                    </button>
                  </>
                )}
              </div>

              {/* Viewer Configuration */}
              <div className="mb-4">
                <label className="form-label fw-bold">
                  <i className="bi bi-gear me-2"></i>
                  Viewer Settings
                </label>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="showCompass"
                    checked={viewerConfig.compass}
                    onChange={(e) =>
                      setViewerConfig((prev) => ({
                        ...prev,
                        compass: e.target.checked,
                      }))
                    }
                  />
                  <label className="form-check-label" htmlFor="showCompass">
                    Show Compass
                  </label>
                </div>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="showControls"
                    checked={viewerConfig.showControls}
                    onChange={(e) =>
                      setViewerConfig((prev) => ({
                        ...prev,
                        showControls: e.target.checked,
                      }))
                    }
                  />
                  <label className="form-check-label" htmlFor="showControls">
                    Show Controls
                  </label>
                </div>
              </div>

              {/* Hotspot Controls */}
              <div className="mb-4">
                <label className="form-label fw-bold">
                  <i className="bi bi-pin-map me-2"></i>
                  Hotspot Management
                </label>
                <div className="row g-2">
                  <div className="col-6">
                    <button
                      className="btn btn-outline-primary w-100"
                      onClick={() => {
                        window.hotspotMode = true;
                      }}
                    >
                      <i className="bi bi-plus-circle me-2"></i>
                      Add Hotspot
                    </button>
                  </div>
                  <div className="col-6">
                    <button
                      className="btn btn-outline-danger w-100"
                      onClick={clearHotspots}
                    >
                      <i className="bi bi-trash me-2"></i>
                      Clear All
                    </button>
                  </div>
                </div>
                {hotspots.length > 0 && (
                  <div className="mt-2">
                    <small className="text-success">
                      <i className="bi bi-check-circle me-1"></i>
                      {hotspots.length} hotspot(s) added
                    </small>
                  </div>
                )}
              </div>

              {/* Export Options */}
              <div className="mb-4">
                <label className="form-label fw-bold">
                  <i className="bi bi-download me-2"></i>
                  Export Options
                </label>
                <div className="d-grid gap-2">
                  <button
                    className="btn btn-success"
                    onClick={exportHTMLViewer}
                    disabled={!panoramaImage && extractedFrames.length === 0}
                  >
                    <i className="bi bi-file-earmark-code me-2"></i>
                    Export HTML Viewer
                  </button>
                  <button
                    className="btn btn-outline-success"
                    onClick={exportConfiguration}
                    disabled={!panoramaImage && extractedFrames.length === 0}
                  >
                    <i className="bi bi-file-earmark-text me-2"></i>
                    Export Config JSON
                  </button>
                </div>
              </div>

              {/* Reset */}
              <div className="d-grid">
                <button
                  className="btn btn-outline-secondary"
                  onClick={resetAll}
                  disabled={isProcessing}
                >
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  Reset All
                </button>
              </div>

              {/* Processing Status */}
              {(isProcessing || processingStep) && (
                <div className="alert alert-info mt-4">
                  <div className="d-flex align-items-center">
                    {isProcessing && (
                      <div className="spinner-border spinner-border-sm me-3"></div>
                    )}
                    <span>{processingStep}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pannellum Viewer */}
        <div className="col-md-8">
          <div className="card h-100">
            <div className="card-header bg-dark text-white">
              <h5 className="card-title mb-0">
                <i className="bi bi-eye me-2"></i>
                360° Panorama Viewer
              </h5>
            </div>
            <div className="card-body p-0">
              <div
                ref={pannellumContainerRef}
                style={{
                  width: "100%",
                  height: "500px",
                  borderRadius: "0 0 8px 8px",
                  overflow: "hidden",
                }}
              />
            </div>
            <div className="card-footer text-muted">
              <small>
                <i className="bi bi-mouse me-1"></i>
                <strong>Controls:</strong> Drag to look around • Scroll to zoom
                • Click hotspots for info • Double-click to zoom
              </small>
            </div>
          </div>

          {/* Extracted Frames Gallery */}
          {extractedFrames.length > 0 && (
            <div className="card mt-3">
              <div className="card-header bg-success text-white">
                <h6 className="mb-0">
                  <i className="bi bi-images me-2"></i>
                  Extracted Frames ({extractedFrames.length})
                </h6>
              </div>
              <div className="card-body">
                <div className="row g-2">
                  {extractedFrames.map((frame, index) => (
                    <div key={index} className="col-lg-2 col-md-3 col-4">
                      <div
                        className={`card frame-thumbnail ${
                          index === currentFrameIndex ? "border-primary" : ""
                        }`}
                        style={{ cursor: "pointer" }}
                        onClick={() => loadFrame(index)}
                      >
                        <img
                          src={frame.dataUrl}
                          alt={frame.title}
                          className="card-img-top"
                          style={{ height: "80px", objectFit: "cover" }}
                        />
                        <div className="card-body p-1">
                          <small className="text-muted d-block text-center">
                            {formatTime(frame.time)}
                          </small>
                        </div>
                        {index === currentFrameIndex && (
                          <div className="position-absolute top-0 end-0 bg-primary text-white px-1 rounded-start">
                            <i className="bi bi-play-fill"></i>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for frame extraction */}
      <canvas ref={extractCanvasRef} style={{ display: "none" }} />

      {/* Usage Instructions */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header bg-info text-white">
              <h6 className="card-title mb-0">
                <i className="bi bi-info-circle me-2"></i>
                Pannellum 360° Viewer Guide
              </h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6 className="text-primary">🌐 Supported Formats:</h6>
                  <ul>
                    <li>
                      <strong>Equirectangular Images:</strong> Standard 360°
                      photos (2:1 aspect ratio)
                    </li>
                    <li>
                      <strong>360° Videos:</strong> Extract frames for panoramic
                      viewing
                    </li>
                    <li>
                      <strong>Cube Maps:</strong> 6-face cube projections
                      (advanced)
                    </li>
                    <li>
                      <strong>Multi-resolution:</strong> Tiled images for
                      high-quality viewing
                    </li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6 className="text-success">💡 Pro Features:</h6>
                  <ul>
                    <li>
                      <strong>Interactive Hotspots:</strong> Add information
                      points
                    </li>
                    <li>
                      <strong>Video Frame Extraction:</strong> Convert video to
                      panorama series
                    </li>
                    <li>
                      <strong>Export Options:</strong> HTML viewer and JSON
                      config
                    </li>
                    <li>
                      <strong>Mobile Friendly:</strong> Touch controls for
                      mobile devices
                    </li>
                  </ul>
                </div>
              </div>
              <div className="alert alert-warning mt-3">
                <i className="bi bi-lightbulb me-2"></i>
                <strong>Tips:</strong> For best results, use equirectangular
                360° images. Click "Add Hotspot" then click anywhere on the
                panorama to add interactive points. Export your panorama as a
                standalone HTML file for sharing.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pannellum;
