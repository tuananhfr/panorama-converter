import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  RotateCcw,
  Download,
  Eye,
  Box,
  ArrowLeft,
  Grid3X3,
  Target,
  CheckCircle,
} from "lucide-react";
import * as THREE from "three";

const ObjectScannerApp = ({ onBack }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const sceneRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]);
  const [scanningPhase, setScanningPhase] = useState("setup"); // 'setup', 'scanning', 'processing', 'complete'
  const [currentAngle, setCurrentAngle] = useState(0);
  const [requiredAngles] = useState([
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
  ]);
  const [capturedAngles, setCapturedAngles] = useState([]);
  const [currentHeight, setCurrentHeight] = useState("middle"); // 'low', 'middle', 'high'
  const [heightProgress, setHeightProgress] = useState({
    low: [],
    middle: [],
    high: [],
  });
  const [scanProgress, setScanProgress] = useState(0);
  const [overlayMessage, setOverlayMessage] = useState("");
  const [is3DReady, setIs3DReady] = useState(false);
  const [pointCloud, setPointCloud] = useState(null);

  // Khởi tạo camera
  const startCamera = async () => {
    console.log("🎥 Starting camera...");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "environment",
        },
      });

      console.log("✅ Camera stream obtained");

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          console.log(
            "✅ Video metadata loaded:",
            videoRef.current.videoWidth,
            "x",
            videoRef.current.videoHeight
          );
          setIsVideoReady(true);
        };

        videoRef.current.oncanplay = () => {
          console.log("✅ Video can play");
        };

        // Force video to play
        videoRef.current.play().catch((e) => {
          console.warn("Video autoplay failed:", e);
        });
      }
    } catch (error) {
      console.error("❌ Camera error:", error);

      // More specific error handling
      if (error.name === "NotAllowedError") {
        alert(
          "❌ Camera permission denied. Please allow camera access and refresh."
        );
      } else if (error.name === "NotFoundError") {
        alert("❌ No camera found. Please connect a camera.");
      } else if (error.name === "NotReadableError") {
        alert(
          "❌ Camera is being used by another app. Please close other camera apps."
        );
      } else {
        alert(`❌ Camera error: ${error.message}`);
      }
    }
  };

  // Dừng camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Khởi tạo 3D Scene
  const init3DViewer = useCallback(() => {
    if (!viewerRef.current || sceneRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 400 / 300, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    renderer.setSize(400, 300);
    renderer.setClearColor(0x000000, 0.1);
    viewerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    camera.position.z = 5;

    sceneRef.current = { scene, camera, renderer };

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (sceneRef.current) {
        sceneRef.current.renderer.render(
          sceneRef.current.scene,
          sceneRef.current.camera
        );
      }
    };
    animate();
  }, []);

  // Capture ảnh với metadata
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    const timestamp = Date.now();

    const imageInfo = {
      id: timestamp,
      data: imageData,
      angle: currentAngle,
      height: currentHeight,
      timestamp: new Date().toISOString(),
      width: canvas.width,
      height: canvas.height,
    };

    setCapturedImages((prev) => [...prev, imageInfo]);

    // Update progress theo height
    setHeightProgress((prev) => ({
      ...prev,
      [currentHeight]: [...prev[currentHeight], currentAngle],
    }));

    setCapturedAngles((prev) => [...prev, currentAngle]);

    // Calculate total progress
    const totalRequired = requiredAngles.length * 3; // 3 heights
    const totalCaptured = Object.values(heightProgress).flat().length + 1;
    setScanProgress((totalCaptured / totalRequired) * 100);

    // Check if current height is complete
    const currentHeightAngles = [
      ...heightProgress[currentHeight],
      currentAngle,
    ];
    if (currentHeightAngles.length >= requiredAngles.length) {
      moveToNextHeight();
    }

    updateOverlayMessage();
  };

  // Di chuyển đến height tiếp theo
  const moveToNextHeight = () => {
    if (currentHeight === "middle") {
      setCurrentHeight("high");
      setOverlayMessage(
        "📈 Di chuyển camera LÊN CAO và tiếp tục quay quanh vật thể"
      );
    } else if (currentHeight === "high") {
      setCurrentHeight("low");
      setOverlayMessage(
        "📉 Di chuyển camera XUỐNG THẤP và tiếp tục quay quanh vật thể"
      );
    } else {
      completeScan();
    }
    setCapturedAngles([]);
  };

  // Cập nhật thông báo
  const updateOverlayMessage = () => {
    const remaining = requiredAngles.filter(
      (angle) =>
        !heightProgress[currentHeight].includes(angle) && angle !== currentAngle
    ).length;

    if (remaining > 0) {
      setOverlayMessage(
        `🎯 Còn ${remaining} góc ở độ cao ${getHeightText(currentHeight)}`
      );
    }
  };

  const getHeightText = (height) => {
    switch (height) {
      case "low":
        return "THẤP";
      case "middle":
        return "GIỮA";
      case "high":
        return "CAO";
      default:
        return "";
    }
  };

  // Hoàn thành quét
  const completeScan = () => {
    setScanningPhase("processing");
    setOverlayMessage("🔄 Đang xử lý và tạo 3D model...");

    // Simulate processing
    setTimeout(() => {
      processImages();
    }, 2000);
  };

  // Xử lý ảnh thành 3D (simplified version)
  const processImages = () => {
    if (!sceneRef.current) return;

    // Create simple point cloud from images
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    // Generate points based on captured images
    capturedImages.forEach((img, index) => {
      const angleRad = (img.angle * Math.PI) / 180;
      const heightOffset =
        img.height === "high" ? 1 : img.height === "low" ? -1 : 0;

      // Create points in 3D space
      for (let i = 0; i < 100; i++) {
        const radius = 2 + Math.random() * 0.5;
        const x = Math.cos(angleRad) * radius + (Math.random() - 0.5) * 0.5;
        const y = heightOffset + (Math.random() - 0.5) * 0.5;
        const z = Math.sin(angleRad) * radius + (Math.random() - 0.5) * 0.5;

        positions.push(x, y, z);
        colors.push(Math.random(), Math.random(), Math.random());
      }
    });

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
    });
    const points = new THREE.Points(geometry, material);

    sceneRef.current.scene.add(points);
    setPointCloud(points);

    setScanningPhase("complete");
    setIs3DReady(true);
    setOverlayMessage("🎉 3D Model hoàn thành!");
  };

  // Reset tất cả
  const resetScan = () => {
    setCapturedImages([]);
    setCapturedAngles([]);
    setHeightProgress({ low: [], middle: [], high: [] });
    setScanProgress(0);
    setScanningPhase("setup");
    setCurrentHeight("middle");
    setOverlayMessage("");
    setIs3DReady(false);
    setIsVideoReady(false);

    if (sceneRef.current && pointCloud) {
      sceneRef.current.scene.remove(pointCloud);
      setPointCloud(null);
    }
  };

  // Bắt đầu quét
  const startScanning = () => {
    setScanningPhase("scanning");
    setCurrentHeight("middle");
    setOverlayMessage(
      "📸 Đặt vật thể ở giữa và bắt đầu chụp từ các góc khác nhau"
    );
  };

  // Export 3D model
  const export3DModel = () => {
    const dataStr = JSON.stringify({
      images: capturedImages.map((img) => ({
        angle: img.angle,
        height: img.height,
        timestamp: img.timestamp,
      })),
      metadata: {
        totalImages: capturedImages.length,
        scanDate: new Date().toISOString(),
        version: "1.0",
      },
    });

    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `3d-scan-${Date.now()}.json`;
    link.click();
  };

  useEffect(() => {
    startCamera();
    init3DViewer();

    return () => {
      stopCamera();
      if (sceneRef.current) {
        sceneRef.current.renderer.dispose();
      }
    };
  }, [init3DViewer]);

  return (
    <div className="min-vh-100 bg-dark text-white">
      {/* Header */}
      <nav className="navbar navbar-dark bg-secondary">
        <div className="container-fluid">
          {onBack && (
            <button onClick={onBack} className="btn btn-outline-light btn-sm">
              <ArrowLeft size={16} className="me-1" />
              Back
            </button>
          )}
          <span className="navbar-brand mx-auto">
            <Box size={20} className="me-2" />
            3D Object Scanner
          </span>
          <div style={{ width: "60px" }}></div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container-fluid p-0">
        {/* Setup Phase */}
        {scanningPhase === "setup" && (
          <div className="text-center p-4">
            <div className="mb-4">
              <Box size={64} className="text-primary mx-auto mb-3" />
              <h3>3D Object Scanner</h3>
              <p className="text-muted">Tạo 3D model từ ảnh chụp đa góc độ</p>
            </div>

            <div className="row justify-content-center mb-4">
              <div className="col-md-8">
                <div className="card bg-secondary">
                  <div className="card-body">
                    <h5 className="card-title">🎯 Hướng dẫn sử dụng:</h5>
                    <div className="text-start">
                      <p>
                        <strong>1. Chuẩn bị:</strong>
                      </p>
                      <ul>
                        <li>Đặt vật thể trên bề mặt phẳng</li>
                        <li>Đảm bảo ánh sáng đầy đủ, đều</li>
                        <li>Vật thể không quá nhỏ hoặc quá bóng</li>
                      </ul>

                      <p>
                        <strong>2. Quét 3 tầng:</strong>
                      </p>
                      <ul>
                        <li>
                          📉 <strong>Tầng thấp:</strong> Camera ở góc thấp
                        </li>
                        <li>
                          📍 <strong>Tầng giữa:</strong> Camera ngang tầm
                        </li>
                        <li>
                          📈 <strong>Tầng cao:</strong> Camera ở góc cao
                        </li>
                      </ul>

                      <p>
                        <strong>3. Chụp:</strong>
                      </p>
                      <ul>
                        <li>Mỗi tầng chụp 12 góc (30° một lần)</li>
                        <li>Giữ khoảng cách ổn định</li>
                        <li>Overlap 50-70% giữa các ảnh</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={startScanning}
              className="btn btn-primary btn-lg"
              disabled={!stream || !isVideoReady}
            >
              <Camera size={24} className="me-2" />
              {!stream
                ? "Đang kết nối camera..."
                : !isVideoReady
                ? "Đang khởi động video..."
                : "Bắt đầu quét 3D"}
            </button>

            {/* Debug Info */}
            <div className="mt-3 p-3 bg-warning text-dark rounded">
              <small>
                <strong>🔧 Debug:</strong>
                <br />
                Stream: {stream ? "✅ Connected" : "❌ Not connected"}
                <br />
                Video Element: {videoRef.current ? "✅ Exists" : "❌ Missing"}
                <br />
                Video Ready: {isVideoReady ? "✅ Ready" : "❌ Not ready"}
                <br />
                Video Playing:{" "}
                {videoRef.current && !videoRef.current.paused
                  ? "✅ Playing"
                  : "❌ Paused"}
                <br />
                Dimensions:{" "}
                {videoRef.current
                  ? `${videoRef.current.videoWidth || 0}x${
                      videoRef.current.videoHeight || 0
                    }`
                  : "N/A"}
                <br />
                ReadyState:{" "}
                {videoRef.current ? videoRef.current.readyState : "N/A"}
              </small>
              <br />
              <button
                className="btn btn-sm btn-dark mt-2 me-2"
                onClick={() => {
                  console.log("=== MANUAL DEBUG ===");
                  console.log("stream:", stream);
                  console.log("videoRef.current:", videoRef.current);
                  console.log(
                    "video dimensions:",
                    videoRef.current?.videoWidth,
                    videoRef.current?.videoHeight
                  );
                  console.log(
                    "video readyState:",
                    videoRef.current?.readyState
                  );
                  console.log("video paused:", videoRef.current?.paused);
                  console.log("isVideoReady:", isVideoReady);
                }}
              >
                🔧 Log Debug
              </button>

              <button
                className="btn btn-sm btn-success mt-2"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.play();
                    console.log("▶️ Manually triggered video play");
                  }
                }}
              >
                ▶️ Force Play
              </button>
            </div>
          </div>
        )}

        {/* Scanning Phase */}
        {scanningPhase === "scanning" && (
          <div>
            {/* Camera View */}
            <div className="position-relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-100"
                style={{ height: "400px", objectFit: "cover" }}
              />

              {/* Overlay Guidelines */}
              <div
                className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{ pointerEvents: "none" }}
              >
                {/* Center Target */}
                <div className="position-absolute">
                  <Target size={40} className="text-warning opacity-75" />
                </div>

                {/* Grid Overlay */}
                <div className="position-absolute w-100 h-100 d-flex">
                  <Grid3X3
                    size={200}
                    className="text-light opacity-25 m-auto"
                  />
                </div>

                {/* Height Indicator */}
                <div className="position-absolute top-0 start-0 m-3">
                  <div className="bg-dark bg-opacity-75 px-3 py-2 rounded">
                    <div className="d-flex align-items-center mb-2">
                      <strong>Độ cao: {getHeightText(currentHeight)}</strong>
                    </div>
                    <div
                      className="progress mb-2"
                      style={{ width: "200px", height: "8px" }}
                    >
                      <div
                        className="progress-bar bg-success"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <small>Tiến độ: {Math.round(scanProgress)}%</small>
                  </div>
                </div>

                {/* Angle Guide */}
                <div className="position-absolute top-0 end-0 m-3">
                  <div className="bg-dark bg-opacity-75 px-3 py-2 rounded text-center">
                    <small>Góc đã chụp:</small>
                    <div className="row g-1 mt-1">
                      {requiredAngles.map((angle) => (
                        <div key={angle} className="col-3">
                          <div
                            className={`badge ${
                              heightProgress[currentHeight].includes(angle)
                                ? "bg-success"
                                : "bg-secondary"
                            }`}
                            style={{ fontSize: "8px" }}
                          >
                            {angle}°
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Message Overlay */}
              {overlayMessage && (
                <div className="position-absolute bottom-0 start-0 end-0 mb-3">
                  <div className="text-center">
                    <div className="bg-dark bg-opacity-75 d-inline-block px-4 py-2 rounded-pill">
                      <small>{overlayMessage}</small>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-3 bg-secondary">
              <div className="row align-items-center">
                <div className="col-3">
                  <button
                    onClick={resetScan}
                    className="btn btn-outline-light w-100"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
                <div className="col-6 text-center">
                  <button
                    onClick={captureImage}
                    className="btn btn-primary btn-lg rounded-circle"
                    style={{ width: "80px", height: "80px" }}
                    disabled={!stream}
                  >
                    <Camera size={30} />
                  </button>
                </div>
                <div className="col-3 text-end">
                  <small className="text-muted">
                    {capturedImages.length} ảnh
                  </small>
                </div>
              </div>
            </div>

            {/* Captured Images Preview */}
            {capturedImages.length > 0 && (
              <div className="p-3 border-top border-dark">
                <h6 className="mb-2">
                  📷 Ảnh đã chụp ({capturedImages.length})
                </h6>
                <div className="d-flex gap-2 overflow-auto">
                  {capturedImages.slice(-8).map((img) => (
                    <div key={img.id} className="flex-shrink-0 text-center">
                      <img
                        src={img.data}
                        alt={`${img.height}-${img.angle}°`}
                        className="border border-secondary rounded"
                        style={{
                          width: "60px",
                          height: "60px",
                          objectFit: "cover",
                        }}
                      />
                      <div className="small mt-1">
                        {img.height[0].toUpperCase()}-{img.angle}°
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing Phase */}
        {scanningPhase === "processing" && (
          <div className="text-center p-5">
            <div
              className="spinner-border text-primary mb-3"
              style={{ width: "3rem", height: "3rem" }}
            >
              <span className="visually-hidden">Loading...</span>
            </div>
            <h4>🔄 Đang xử lý...</h4>
            <p className="text-muted">
              Tạo 3D model từ {capturedImages.length} ảnh
            </p>
          </div>
        )}

        {/* Complete Phase */}
        {scanningPhase === "complete" && (
          <div>
            <div className="text-center p-3 bg-success">
              <CheckCircle size={32} className="me-2" />
              <strong>🎉 3D Model hoàn thành!</strong>
            </div>

            {/* 3D Viewer */}
            <div className="p-3">
              <h5 className="mb-3">
                <Eye size={20} className="me-2" />
                3D Model Preview
              </h5>
              <div className="bg-secondary rounded p-3 text-center">
                <div
                  ref={viewerRef}
                  className="mx-auto"
                  style={{ width: "400px", height: "300px" }}
                />
                <p className="text-muted mt-2">
                  Point Cloud từ {capturedImages.length} ảnh
                </p>
              </div>
            </div>

            {/* Export Options */}
            <div className="p-3">
              <div className="row g-2">
                <div className="col-6">
                  <button
                    onClick={export3DModel}
                    className="btn btn-primary w-100"
                  >
                    <Download size={16} className="me-2" />
                    Export Data
                  </button>
                </div>
                <div className="col-6">
                  <button
                    onClick={resetScan}
                    className="btn btn-outline-secondary w-100"
                  >
                    <RotateCcw size={16} className="me-2" />
                    Scan mới
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-3 border-top border-secondary">
              <h6>📊 Thống kê:</h6>
              <div className="row text-center">
                <div className="col-4">
                  <div className="bg-secondary rounded p-2">
                    <div className="h5 mb-0">{capturedImages.length}</div>
                    <small className="text-muted">Ảnh</small>
                  </div>
                </div>
                <div className="col-4">
                  <div className="bg-secondary rounded p-2">
                    <div className="h5 mb-0">3</div>
                    <small className="text-muted">Tầng độ cao</small>
                  </div>
                </div>
                <div className="col-4">
                  <div className="bg-secondary rounded p-2">
                    <div className="h5 mb-0">360°</div>
                    <small className="text-muted">Coverage</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="d-none" />
    </div>
  );
};

export default ObjectScannerApp;
