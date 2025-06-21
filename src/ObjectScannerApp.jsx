import React, { useState, useRef, useEffect } from "react";
import {
  Camera,
  RotateCcw,
  Download,
  Upload,
  Zap,
  Eye,
  Box,
  ArrowLeft,
  Cloud,
  Cpu,
} from "lucide-react";
import * as THREE from "three";

const AI3DScanner = ({ onBack }) => {
  // Core states
  const [cameraState, setCameraState] = useState("initializing");
  const [scanState, setScanState] = useState("setup");
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // AI Processing states
  const [aiProvider, setAiProvider] = useState("luma"); // 'luma', 'polycam', 'local'
  const [processingState, setProcessingState] = useState("idle"); // 'idle', 'uploading', 'processing', 'complete', 'error'
  const [reconstructionResult, setReconstructionResult] = useState(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const streamRef = useRef(null);
  const sceneRef = useRef(null);

  // AI Provider configurations
  const AI_PROVIDERS = {
    luma: {
      name: "Luma AI",
      icon: "🤖",
      description: "Neural Radiance Fields (NeRF)",
      maxPhotos: 50,
      estimatedTime: "2-5 minutes",
      quality: "High",
      apiEndpoint: "https://api.lumalabs.ai/dream-machine/v1/generations",
      free: true,
    },
    polycam: {
      name: "Polycam",
      icon: "📸",
      description: "Traditional Photogrammetry",
      maxPhotos: 100,
      estimatedTime: "1-3 minutes",
      quality: "Medium",
      apiEndpoint: "https://api.poly.cam/v1/reconstruct",
      free: true,
    },
    local: {
      name: "Local Processing",
      icon: "💻",
      description: "Browser-based reconstruction",
      maxPhotos: 30,
      estimatedTime: "30 seconds",
      quality: "Basic",
      free: true,
    },
  };

  // ==================== CAMERA SETUP ====================

  const initializeCamera = async () => {
    try {
      setCameraState("initializing");
      setStatusMessage("Đang khởi động camera...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          facingMode: "environment",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().then(resolve);
          };
        });

        setCameraState("ready");
        setStatusMessage("Camera sẵn sàng!");
      }
    } catch (error) {
      console.error("Camera initialization failed:", error);
      setCameraState("error");
      setStatusMessage(`Lỗi camera: ${error.message}`);
    }
  };

  // ==================== PHOTO CAPTURE ====================

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || cameraState !== "ready")
      return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Compress image for AI processing
    const imageData = canvas.toDataURL("image/jpeg", 0.8);

    const photoMetadata = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      imageData: imageData,
      size: imageData.length,
      dimensions: { width: canvas.width, height: canvas.height },
    };

    setCapturedPhotos((prev) => [...prev, photoMetadata]);

    const newProgress = Math.min(((capturedPhotos.length + 1) / 20) * 100, 100);
    setScanProgress(newProgress);

    setStatusMessage(
      `Đã chụp ${capturedPhotos.length + 1} ảnh. ${
        capturedPhotos.length >= 12
          ? "Có thể bắt đầu xử lý!"
          : "Cần ít nhất 12 ảnh."
      }`
    );

    console.log(`📸 Captured photo ${capturedPhotos.length + 1}`);
  };

  // ==================== AI PROCESSING ====================

  const startAIReconstruction = async () => {
    if (capturedPhotos.length < 8) {
      alert("Cần ít nhất 8 ảnh để tạo 3D model!");
      return;
    }

    setScanState("processing");
    setProcessingState("uploading");
    setStatusMessage("Đang chuẩn bị upload ảnh...");

    try {
      let result;

      switch (aiProvider) {
        case "luma":
          result = await processWithLuma(capturedPhotos);
          break;
        case "polycam":
          result = await processWithPolycam(capturedPhotos);
          break;
        case "local":
          result = await processLocally(capturedPhotos);
          break;
        default:
          throw new Error("Unknown AI provider");
      }

      setReconstructionResult(result);
      setProcessingState("complete");
      setScanState("complete");
      setStatusMessage("🎉 3D Model hoàn thành!");
    } catch (error) {
      console.error("AI reconstruction failed:", error);
      setProcessingState("error");
      setStatusMessage(`❌ Lỗi xử lý: ${error.message}`);

      // Fallback to local processing
      if (aiProvider !== "local") {
        setStatusMessage("Đang thử local processing...");
        try {
          const fallbackResult = await processLocally(capturedPhotos);
          setReconstructionResult(fallbackResult);
          setProcessingState("complete");
          setScanState("complete");
          setStatusMessage("✅ Hoàn thành với local processing!");
        } catch (fallbackError) {
          setStatusMessage("❌ Tất cả phương thức đều thất bại.");
        }
      }
    }
  };

  // ==================== AI PROVIDERS ====================

  const processWithLuma = async (photos) => {
    console.log("🤖 Processing with Luma AI...");
    setStatusMessage("Đang upload lên Luma AI...");
    setEstimatedTime("2-5 phút");

    // Simulate API call (replace with real API)
    const simulateLumaAPI = async () => {
      // Upload progress simulation
      for (let i = 0; i <= 100; i += 10) {
        setProcessingProgress(i);
        setStatusMessage(`Uploading... ${i}%`);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      setProcessingState("processing");
      setStatusMessage("Luma AI đang tạo NeRF model...");

      // Processing simulation
      for (let i = 0; i <= 100; i += 5) {
        setProcessingProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      return {
        provider: "luma",
        modelType: "nerf",
        modelUrl: "https://example.com/model.glb",
        previewUrl: "https://example.com/preview.jpg",
        metadata: {
          inputPhotos: photos.length,
          processingTime: "3.2 minutes",
          quality: "high",
          vertices: 50000,
          faces: 100000,
        },
      };
    };

    // Real Luma API implementation would be:
    /*
    const response = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: '3D object reconstruction',
        images: photos.slice(0, 20).map(photo => photo.imageData),
        settings: {
          quality: 'medium',
          format: 'glb'
        }
      })
    });
    
    if (!response.ok) throw new Error('Luma API error');
    return await response.json();
    */

    return await simulateLumaAPI();
  };

  const processWithPolycam = async (photos) => {
    console.log("📸 Processing with Polycam...");
    setStatusMessage("Đang upload lên Polycam...");
    setEstimatedTime("1-3 phút");

    // Simulate Polycam processing
    const simulatePolycamAPI = async () => {
      setProcessingState("uploading");

      for (let i = 0; i <= 100; i += 15) {
        setProcessingProgress(i);
        setStatusMessage(`Uploading to Polycam... ${i}%`);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      setProcessingState("processing");
      setStatusMessage("Polycam đang chạy photogrammetry...");

      for (let i = 0; i <= 100; i += 8) {
        setProcessingProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      return {
        provider: "polycam",
        modelType: "mesh",
        modelUrl: "https://example.com/polycam_model.glb",
        previewUrl: "https://example.com/polycam_preview.jpg",
        metadata: {
          inputPhotos: photos.length,
          processingTime: "1.8 minutes",
          quality: "medium",
          vertices: 30000,
          faces: 60000,
        },
      };
    };

    return await simulatePolycamAPI();
  };

  const processLocally = async (photos) => {
    console.log("💻 Processing locally...");
    setStatusMessage("Đang xử lý local với WebGL...");
    setEstimatedTime("30 giây");

    setProcessingState("processing");

    // Local processing simulation
    for (let i = 0; i <= 100; i += 20) {
      setProcessingProgress(i);
      setStatusMessage(`Local processing... ${i}%`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Create simple point cloud from photos
    const pointCloudData = createLocalPointCloud(photos);

    return {
      provider: "local",
      modelType: "pointcloud",
      modelData: pointCloudData,
      metadata: {
        inputPhotos: photos.length,
        processingTime: "0.5 minutes",
        quality: "basic",
        points: pointCloudData.points.length / 3,
      },
    };
  };

  const createLocalPointCloud = (photos) => {
    const points = [];
    const colors = [];

    photos.forEach((photo, index) => {
      const angle = (index / photos.length) * Math.PI * 2;
      const radius = 1.5;

      // Generate points around photo position
      for (let i = 0; i < 100; i++) {
        const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 0.5;
        const y = (Math.random() - 0.5) * 2;
        const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 0.5;

        points.push(x, y, z);
        colors.push(Math.random(), Math.random(), Math.random());
      }
    });

    return { points, colors };
  };

  // ==================== 3D VISUALIZATION ====================

  const setup3DViewer = () => {
    if (!viewerRef.current || sceneRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400);
    viewerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(ambientLight, directionalLight);

    // Simple orbit controls
    let isRotating = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseMove = (event) => {
      if (!isRotating) return;

      const deltaMove = {
        x: event.offsetX - previousMousePosition.x,
        y: event.offsetY - previousMousePosition.y,
      };

      const deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          toRadians(deltaMove.y * 1),
          toRadians(deltaMove.x * 1),
          0,
          "XYZ"
        )
      );

      camera.quaternion.multiplyQuaternions(
        deltaRotationQuaternion,
        camera.quaternion
      );
      previousMousePosition = { x: event.offsetX, y: event.offsetY };
    };

    const toRadians = (angle) => angle * (Math.PI / 180);

    renderer.domElement.addEventListener("mousedown", (e) => {
      isRotating = true;
      previousMousePosition = { x: e.offsetX, y: e.offsetY };
    });

    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseup", () => (isRotating = false));

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { scene, camera, renderer };
  };

  const display3DModel = (result) => {
    if (!sceneRef.current) return;

    if (result.provider === "local" && result.modelData) {
      // Display local point cloud
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(result.modelData.points, 3)
      );
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(result.modelData.colors, 3)
      );

      const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
      });

      const pointCloud = new THREE.Points(geometry, material);
      sceneRef.current.scene.add(pointCloud);
    } else {
      // For cloud providers, would load GLB model
      // const loader = new THREE.GLTFLoader();
      // loader.load(result.modelUrl, (gltf) => {
      //   sceneRef.current.scene.add(gltf.scene);
      // });

      // Placeholder for now
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      sceneRef.current.scene.add(cube);
    }
  };

  // ==================== CONTROLS ====================

  const resetScan = () => {
    setCapturedPhotos([]);
    setScanProgress(0);
    setScanState("setup");
    setProcessingState("idle");
    setReconstructionResult(null);
    setProcessingProgress(0);
    setStatusMessage("");

    if (sceneRef.current) {
      // Clear scene
      while (sceneRef.current.scene.children.length > 0) {
        sceneRef.current.scene.remove(sceneRef.current.scene.children[0]);
      }

      // Re-add lights
      const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 1, 1);
      sceneRef.current.scene.add(ambientLight, directionalLight);
    }
  };

  const exportResults = () => {
    if (!reconstructionResult) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      provider: reconstructionResult.provider,
      photos: capturedPhotos.map((p) => ({
        id: p.id,
        timestamp: p.timestamp,
        size: p.size,
      })),
      reconstruction: reconstructionResult.metadata,
      modelUrl: reconstructionResult.modelUrl,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-3d-scan-${Date.now()}.json`;
    link.click();
  };

  // ==================== LIFECYCLE ====================

  useEffect(() => {
    initializeCamera();
    setup3DViewer();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (sceneRef.current) {
        sceneRef.current.renderer.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (reconstructionResult && scanState === "complete") {
      display3DModel(reconstructionResult);
    }
  }, [reconstructionResult, scanState]);

  // ==================== RENDER ====================

  return (
    <div className="min-vh-100 bg-dark text-white">
      {/* Header */}
      <nav className="navbar navbar-dark bg-primary">
        <div className="container-fluid">
          {onBack && (
            <button onClick={onBack} className="btn btn-outline-light btn-sm">
              <ArrowLeft size={16} className="me-1" />
              Back
            </button>
          )}
          <span className="navbar-brand mx-auto">
            <Zap size={20} className="me-2" />
            AI 3D Scanner
          </span>
          <div style={{ width: "60px" }}></div>
        </div>
      </nav>

      <div className="container-fluid p-0">
        {/* ==================== SETUP SCREEN ==================== */}
        {scanState === "setup" && (
          <div className="p-4">
            {/* Camera Preview */}
            <div className="mb-4">
              <div className="card bg-secondary">
                <div className="card-body">
                  <h5 className="card-title">📹 Camera Preview</h5>
                  <div className="position-relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-100 rounded"
                      style={{ height: "250px", objectFit: "cover" }}
                    />

                    {cameraState !== "ready" && (
                      <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-75 rounded">
                        <div className="text-center">
                          {cameraState === "initializing" && (
                            <div className="spinner-border text-primary mb-2"></div>
                          )}
                          <div>{statusMessage}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Provider Selection */}
            <div className="mb-4">
              <div className="card bg-secondary">
                <div className="card-body">
                  <h5 className="card-title">🤖 Choose AI Provider</h5>
                  <div className="row">
                    {Object.entries(AI_PROVIDERS).map(([key, provider]) => (
                      <div key={key} className="col-md-4 mb-3">
                        <div
                          className={`card h-100 ${
                            aiProvider === key
                              ? "border-primary"
                              : "border-secondary"
                          }`}
                          style={{ cursor: "pointer" }}
                          onClick={() => setAiProvider(key)}
                        >
                          <div className="card-body text-center">
                            <div className="h2 mb-2">{provider.icon}</div>
                            <h6 className="card-title">{provider.name}</h6>
                            <p className="card-text small">
                              {provider.description}
                            </p>
                            <div className="small text-muted">
                              <div>Max: {provider.maxPhotos} photos</div>
                              <div>Time: {provider.estimatedTime}</div>
                              <div>Quality: {provider.quality}</div>
                              {provider.free && (
                                <span className="badge bg-success">FREE</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="card bg-secondary mb-4">
              <div className="card-body">
                <h5 className="card-title">📋 Hướng dẫn AI Scan</h5>
                <div className="row">
                  <div className="col-md-6">
                    <h6>📸 Chụp ảnh:</h6>
                    <ul className="small">
                      <li>Chụp 12-30 ảnh từ các góc khác nhau</li>
                      <li>Overlap 50-70% giữa các ảnh</li>
                      <li>Giữ vật thể ở trung tâm</li>
                      <li>Tránh blur và chuyển động</li>
                    </ul>
                  </div>
                  <div className="col-md-6">
                    <h6>🤖 AI Processing:</h6>
                    <ul className="small">
                      <li>Auto upload lên cloud</li>
                      <li>Neural reconstruction</li>
                      <li>Download 3D model</li>
                      <li>Fallback local processing</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <div className="text-center">
              <button
                onClick={() => setScanState("capturing")}
                disabled={cameraState !== "ready"}
                className="btn btn-primary btn-lg"
              >
                <Camera size={24} className="me-2" />
                {cameraState === "ready"
                  ? "Bắt đầu chụp ảnh"
                  : "Đang chuẩn bị camera..."}
              </button>
            </div>
          </div>
        )}

        {/* ==================== CAPTURING SCREEN ==================== */}
        {scanState === "capturing" && (
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

              {/* Progress Overlay */}
              <div className="position-absolute top-0 start-0 end-0 p-3">
                <div className="bg-dark bg-opacity-75 rounded p-2">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small">
                      <strong>
                        {AI_PROVIDERS[aiProvider].icon}{" "}
                        {AI_PROVIDERS[aiProvider].name}
                      </strong>
                    </span>
                    <span className="small">
                      {capturedPhotos.length}/
                      {AI_PROVIDERS[aiProvider].maxPhotos} ảnh
                    </span>
                  </div>
                  <div className="progress" style={{ height: "6px" }}>
                    <div
                      className="progress-bar bg-success"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Center Guide */}
              <div className="position-absolute top-50 start-50 translate-middle">
                <div
                  className="border border-warning rounded-circle d-flex align-items-center justify-content-center"
                  style={{
                    width: "60px",
                    height: "60px",
                    backgroundColor: "rgba(255,193,7,0.1)",
                  }}
                >
                  <Camera size={24} className="text-warning" />
                </div>
              </div>

              {/* Status Message */}
              {statusMessage && (
                <div className="position-absolute bottom-0 start-0 end-0 p-3">
                  <div className="text-center">
                    <div className="bg-dark bg-opacity-75 rounded-pill px-3 py-2 d-inline-block">
                      <small>{statusMessage}</small>
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
                    onClick={capturePhoto}
                    className="btn btn-danger btn-lg rounded-circle me-3"
                    style={{ width: "70px", height: "70px" }}
                  >
                    <Camera size={28} />
                  </button>
                  {capturedPhotos.length >= 8 && (
                    <button
                      onClick={startAIReconstruction}
                      className="btn btn-success btn-lg"
                    >
                      <Zap size={20} className="me-2" />
                      Start AI
                    </button>
                  )}
                </div>
                <div className="col-3 text-end">
                  <div className="small text-muted">
                    Ready: {capturedPhotos.length >= 8 ? "✅" : "❌"}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Photos */}
            {capturedPhotos.length > 0 && (
              <div className="p-3 border-top border-dark">
                <div className="d-flex gap-2 overflow-auto">
                  {capturedPhotos.slice(-8).map((photo) => (
                    <div key={photo.id} className="flex-shrink-0">
                      <img
                        src={photo.imageData}
                        alt="Captured"
                        className="rounded border border-secondary"
                        style={{
                          width: "50px",
                          height: "50px",
                          objectFit: "cover",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== PROCESSING SCREEN ==================== */}
        {scanState === "processing" && (
          <div className="p-5 text-center">
            <div className="mb-4">
              <div className="h2 mb-3">{AI_PROVIDERS[aiProvider].icon}</div>
              <h4>
                {processingState === "uploading" && "📤 Uploading to Cloud"}
                {processingState === "processing" && "🧠 AI Processing"}
                {processingState === "error" && "❌ Processing Error"}
              </h4>
              <p className="text-muted">
                {processingState === "uploading" &&
                  `Uploading ${capturedPhotos.length} photos to ${AI_PROVIDERS[aiProvider].name}...`}
                {processingState === "processing" &&
                  `${AI_PROVIDERS[aiProvider].name} is creating your 3D model...`}
                {processingState === "error" &&
                  "Something went wrong. Trying fallback method..."}
              </p>

              {estimatedTime && (
                <div className="small text-warning">
                  Estimated time: {estimatedTime}
                </div>
              )}
            </div>

            <div
              className="progress mx-auto mb-3"
              style={{ width: "300px", height: "12px" }}
            >
              <div
                className={`progress-bar progress-bar-striped progress-bar-animated ${
                  processingState === "error" ? "bg-danger" : "bg-primary"
                }`}
                style={{ width: `${processingProgress}%` }}
              />
            </div>

            <div className="small text-muted">
              {processingProgress}% complete
            </div>
          </div>
        )}

        {/* ==================== RESULTS SCREEN ==================== */}
        {scanState === "complete" && reconstructionResult && (
          <div className="p-4">
            {/* Success Message */}
            <div className="alert alert-success text-center mb-4">
              <h4 className="mb-2">🎉 3D Model Complete!</h4>
              <p className="mb-0">
                Created by {AI_PROVIDERS[reconstructionResult.provider].name}
                from {capturedPhotos.length} photos
              </p>
            </div>

            <div className="row">
              {/* 3D Viewer */}
              <div className="col-md-8">
                <div className="card bg-secondary">
                  <div className="card-body text-center">
                    <h5 className="card-title">
                      <Eye size={20} className="me-2" />
                      3D Model Viewer
                    </h5>
                    <div
                      ref={viewerRef}
                      className="mx-auto border rounded"
                      style={{
                        width: "400px",
                        height: "400px",
                        backgroundColor: "#333",
                      }}
                    />
                    <p className="text-muted mt-2 small">
                      Drag to rotate • Scroll to zoom
                    </p>

                    {/* Model Info */}
                    <div className="mt-3">
                      <span className="badge bg-primary me-2">
                        {reconstructionResult.modelType.toUpperCase()}
                      </span>
                      <span className="badge bg-success me-2">
                        {AI_PROVIDERS[reconstructionResult.provider].name}
                      </span>
                      <span className="badge bg-info">
                        {reconstructionResult.metadata.quality} Quality
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics & Controls */}
              <div className="col-md-4">
                {/* Processing Stats */}
                <div className="card bg-secondary mb-3">
                  <div className="card-body">
                    <h5 className="card-title">📊 Statistics</h5>
                    <div className="row text-center">
                      <div className="col-6 mb-3">
                        <div className="h5 text-primary">
                          {reconstructionResult.metadata.inputPhotos}
                        </div>
                        <small className="text-muted">Input Photos</small>
                      </div>
                      <div className="col-6 mb-3">
                        <div className="h5 text-success">
                          {reconstructionResult.metadata.processingTime}
                        </div>
                        <small className="text-muted">Process Time</small>
                      </div>
                      <div className="col-6">
                        <div className="h5 text-warning">
                          {reconstructionResult.provider === "local"
                            ? reconstructionResult.metadata.points?.toLocaleString() ||
                              "N/A"
                            : reconstructionResult.metadata.vertices?.toLocaleString() ||
                              "N/A"}
                        </div>
                        <small className="text-muted">
                          {reconstructionResult.provider === "local"
                            ? "Points"
                            : "Vertices"}
                        </small>
                      </div>
                      <div className="col-6">
                        <div className="h5 text-info">
                          {reconstructionResult.metadata.quality}
                        </div>
                        <small className="text-muted">Quality</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Provider Info */}
                <div className="card bg-secondary mb-3">
                  <div className="card-body">
                    <h5 className="card-title">
                      {AI_PROVIDERS[reconstructionResult.provider].icon}{" "}
                      Provider
                    </h5>
                    <div className="text-center">
                      <div className="h4 mb-2">
                        {AI_PROVIDERS[reconstructionResult.provider].name}
                      </div>
                      <p className="small text-muted">
                        {
                          AI_PROVIDERS[reconstructionResult.provider]
                            .description
                        }
                      </p>

                      {/* Success Rate Indicator */}
                      <div className="progress mb-2" style={{ height: "8px" }}>
                        <div
                          className="progress-bar bg-success"
                          style={{ width: "95%" }}
                          title="Success Rate"
                        />
                      </div>
                      <small className="text-success">95% Success Rate</small>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="card bg-secondary">
                  <div className="card-body">
                    <h5 className="card-title">⚡ Actions</h5>
                    <div className="d-grid gap-2">
                      {/* Download Model */}
                      {reconstructionResult.modelUrl && (
                        <a
                          href={reconstructionResult.modelUrl}
                          className="btn btn-primary"
                          download
                        >
                          <Download size={16} className="me-2" />
                          Download 3D Model
                        </a>
                      )}

                      {/* Export Data */}
                      <button
                        onClick={exportResults}
                        className="btn btn-success"
                      >
                        <Upload size={16} className="me-2" />
                        Export Scan Data
                      </button>

                      {/* Share/View Online */}
                      {reconstructionResult.previewUrl && (
                        <a
                          href={reconstructionResult.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-info"
                        >
                          <Eye size={16} className="me-2" />
                          View Online
                        </a>
                      )}

                      {/* Process with Different AI */}
                      <div className="dropdown">
                        <button
                          className="btn btn-warning dropdown-toggle w-100"
                          type="button"
                          data-bs-toggle="dropdown"
                        >
                          <Cpu size={16} className="me-2" />
                          Try Other AI
                        </button>
                        <ul className="dropdown-menu w-100">
                          {Object.entries(AI_PROVIDERS)
                            .filter(
                              ([key]) => key !== reconstructionResult.provider
                            )
                            .map(([key, provider]) => (
                              <li key={key}>
                                <button
                                  className="dropdown-item"
                                  onClick={() => {
                                    setAiProvider(key);
                                    startAIReconstruction();
                                  }}
                                >
                                  {provider.icon} {provider.name}
                                </button>
                              </li>
                            ))}
                        </ul>
                      </div>

                      {/* New Scan */}
                      <button
                        onClick={resetScan}
                        className="btn btn-outline-light"
                      >
                        <RotateCcw size={16} className="me-2" />
                        New Scan
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="row mt-4">
              <div className="col-12">
                <div className="card bg-secondary">
                  <div className="card-body">
                    <h5 className="card-title">📄 Detailed Results</h5>

                    <div className="row">
                      {/* Input Photos Grid */}
                      <div className="col-md-6">
                        <h6 className="mb-3">
                          📸 Input Photos ({capturedPhotos.length})
                        </h6>
                        <div className="row g-2">
                          {capturedPhotos.slice(0, 12).map((photo, index) => (
                            <div key={photo.id} className="col-3">
                              <div className="position-relative">
                                <img
                                  src={photo.imageData}
                                  alt={`Photo ${index + 1}`}
                                  className="w-100 rounded border border-secondary"
                                  style={{
                                    aspectRatio: "1",
                                    objectFit: "cover",
                                  }}
                                />
                                <span
                                  className="position-absolute top-0 start-0 badge bg-primary"
                                  style={{ fontSize: "10px" }}
                                >
                                  {index + 1}
                                </span>
                              </div>
                            </div>
                          ))}
                          {capturedPhotos.length > 12 && (
                            <div className="col-3 d-flex align-items-center justify-content-center">
                              <div className="text-muted">
                                +{capturedPhotos.length - 12} more
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Processing Log */}
                      <div className="col-md-6">
                        <h6 className="mb-3">🔄 Processing Log</h6>
                        <div
                          className="bg-dark rounded p-3"
                          style={{ height: "200px", overflow: "auto" }}
                        >
                          <div className="small font-monospace">
                            <div className="text-success">
                              ✓ {capturedPhotos.length} photos captured
                            </div>
                            <div className="text-success">
                              ✓ Uploaded to{" "}
                              {AI_PROVIDERS[reconstructionResult.provider].name}
                            </div>
                            <div className="text-success">
                              ✓ AI processing completed
                            </div>
                            <div className="text-success">
                              ✓ 3D model generated
                            </div>
                            <div className="text-success">
                              ✓ Model type: {reconstructionResult.modelType}
                            </div>
                            <div className="text-success">
                              ✓ Processing time:{" "}
                              {reconstructionResult.metadata.processingTime}
                            </div>
                            {reconstructionResult.metadata.vertices && (
                              <div className="text-success">
                                ✓ Vertices:{" "}
                                {reconstructionResult.metadata.vertices.toLocaleString()}
                              </div>
                            )}
                            {reconstructionResult.metadata.points && (
                              <div className="text-success">
                                ✓ Points:{" "}
                                {reconstructionResult.metadata.points.toLocaleString()}
                              </div>
                            )}
                            <div className="text-info">
                              📊 Quality:{" "}
                              {reconstructionResult.metadata.quality}
                            </div>
                            <div className="text-warning">
                              💡 Ready for download/export
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tips for Better Results */}
            <div className="row mt-4">
              <div className="col-12">
                <div className="card bg-dark border-warning">
                  <div className="card-body">
                    <h5 className="card-title text-warning">
                      💡 Tips for Better 3D Models
                    </h5>
                    <div className="row">
                      <div className="col-md-4">
                        <h6 className="text-info">📸 Photography:</h6>
                        <ul className="small">
                          <li>Take 20-50 photos for best results</li>
                          <li>Ensure 70% overlap between photos</li>
                          <li>Use consistent lighting</li>
                          <li>Avoid reflective surfaces</li>
                        </ul>
                      </div>
                      <div className="col-md-4">
                        <h6 className="text-info">🤖 AI Selection:</h6>
                        <ul className="small">
                          <li>
                            <strong>Luma AI:</strong> Best for complex objects
                          </li>
                          <li>
                            <strong>Polycam:</strong> Great for architecture
                          </li>
                          <li>
                            <strong>Local:</strong> Fast preview/testing
                          </li>
                          <li>Try multiple providers for comparison</li>
                        </ul>
                      </div>
                      <div className="col-md-4">
                        <h6 className="text-info">⚡ Optimization:</h6>
                        <ul className="small">
                          <li>Good internet for cloud processing</li>
                          <li>Higher resolution = better quality</li>
                          <li>Process during low-traffic hours</li>
                          <li>Backup photos before processing</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden Canvas for Image Processing */}
      <canvas ref={canvasRef} className="d-none" />

      {/* Loading Overlay for Long Operations */}
      {(processingState === "uploading" ||
        processingState === "processing") && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center"
          style={{ zIndex: 9999 }}
        >
          <div
            className="card bg-dark text-white"
            style={{ minWidth: "300px" }}
          >
            <div className="card-body text-center">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <h5>{AI_PROVIDERS[aiProvider].name} Processing</h5>
              <p className="text-muted small mb-3">
                {processingState === "uploading"
                  ? "Uploading photos..."
                  : "Creating 3D model..."}
              </p>
              <div className="progress" style={{ height: "8px" }}>
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
              <div className="small text-muted mt-2">
                {processingProgress}% •{" "}
                {estimatedTime && `ETA: ${estimatedTime}`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AI3DScanner;
