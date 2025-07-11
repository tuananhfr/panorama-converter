import React, { useState, useRef, useEffect } from "react";

const PanoramaStitcher = () => {
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [resultImage, setResultImage] = useState(null);
  const [debugInfo, setDebugInfo] = useState("");
  const [panoramaMode, setPanoramaMode] = useState("auto"); // auto, regular, force360
  const [processingStage, setProcessingStage] = useState("");

  // Camera capture states
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const backendUrl = "http://localhost:5000";

  const MAX_IMAGES = 30; // Giảm xuống từ 100 để tối ưu
  const MIN_IMAGES = 2;
  const IMAGES_360_THRESHOLD = 6; // Threshold for auto 360° detection

  // Check backend status
  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      setBackendStatus("checking");
      const response = await fetch(`${backendUrl}/health`, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        setBackendStatus("connected");
        setDebugInfo(
          `🟢 Backend Ready - OpenCV ${
            data.opencv_version || "Unknown"
          } - 360° Support: ${data.supports_360 ? "✅" : "❌"}`
        );
      } else {
        setBackendStatus("error");
        setDebugInfo("🔴 Backend connection failed");
      }
    } catch (error) {
      setBackendStatus("error");
      setDebugInfo(`🔴 Backend error: ${error.message}`);
    }
  };

  // Test features - Updated for FastAPI
  const testFeatures = async () => {
    if (images.length === 0) {
      alert("Please upload some images first");
      return;
    }

    try {
      setDebugInfo("🔍 Testing image features...");

      const formData = new FormData();
      images.forEach((img) => {
        formData.append("images", img.file);
      });

      const response = await fetch(`${backendUrl}/test_features`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        let debugText = "🔍 FEATURE ANALYSIS:\n";
        data.results.forEach((result) => {
          debugText += `Image ${result.image}: ${result.keypoints} keypoints, ${result.descriptors} descriptors\n`;
        });
        setDebugInfo(debugText);
      } else {
        const errorData = await response.json();
        setDebugInfo(
          `❌ Feature test failed: ${errorData.detail || "Unknown error"}`
        );
      }
    } catch (error) {
      setDebugInfo(`❌ Feature test error: ${error.message}`);
    }
  };

  // Get panorama mode info
  const getPanoramaModeInfo = () => {
    if (panoramaMode === "force360") {
      return {
        mode: "360°",
        color: "success",
        icon: "🌍",
        description: "Force 360° panorama",
      };
    } else if (panoramaMode === "regular") {
      return {
        mode: "Linear",
        color: "primary",
        icon: "📐",
        description: "Regular panorama",
      };
    } else {
      // Auto mode
      if (images.length >= IMAGES_360_THRESHOLD) {
        return {
          mode: "Auto-360°",
          color: "success",
          icon: "🌍",
          description: `Auto-detected 360° mode (${images.length} images)`,
        };
      } else {
        return {
          mode: "Auto-Linear",
          color: "primary",
          icon: "📐",
          description: `Auto-detected linear mode (${images.length} images)`,
        };
      }
    }
  };

  // Initialize camera
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Trình duyệt không hỗ trợ camera!");
        return;
      }

      if (images.length >= MAX_IMAGES) {
        alert(`Đã đạt giới hạn ${MAX_IMAGES} ảnh!`);
        return;
      }

      setShowCamera(true);
      setIsCameraActive(true);

      let mediaStream;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "environment",
          },
        });
      } catch (backCameraError) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            },
          });
        } catch (frontCameraError) {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
        }
      }

      if (videoRef.current && mediaStream) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);

        try {
          await videoRef.current.play();
        } catch (playError) {
          console.log("Video play error:", playError);
        }
      }
    } catch (error) {
      console.error("Camera error:", error);
      setShowCamera(false);
      setIsCameraActive(false);

      let errorMessage = "Không thể truy cập camera: ";

      if (error.name === "NotAllowedError") {
        errorMessage += "Bạn đã từ chối quyền truy cập camera.";
      } else if (error.name === "NotFoundError") {
        errorMessage += "Không tìm thấy camera nào.";
      } else if (error.name === "NotReadableError") {
        errorMessage += "Camera đang được sử dụng bởi ứng dụng khác.";
      } else {
        errorMessage += error.message || "Lỗi không xác định.";
      }

      alert(errorMessage);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    if (images.length >= MAX_IMAGES) {
      alert(`Đã đạt giới hạn ${MAX_IMAGES} ảnh!`);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        const file = new File([blob], `photo_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const imageUrl = URL.createObjectURL(blob);

        const newImage = { file, element: null, name: file.name };

        setImages((prev) => [...prev, newImage]);
        setPreviews((prev) => [...prev, imageUrl]);
        setDebugInfo(`📷 Photo captured. Total: ${images.length + 1} images`);
      },
      "image/jpeg",
      0.9
    );
  };

  // Handle file upload
  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);

    if (images.length + fileArray.length > MAX_IMAGES) {
      alert(`Chỉ có thể thêm tối đa ${MAX_IMAGES - images.length} ảnh nữa!`);
      return;
    }

    let loadedCount = 0;
    const newImages = [];
    const newPreviews = [];

    fileArray.forEach((file, index) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          newImages[index] = { file: file, element: img, name: file.name };
          newPreviews[index] = e.target.result;
          loadedCount++;

          if (loadedCount === fileArray.length) {
            setImages((prev) => [...prev, ...newImages.filter(Boolean)]);
            setPreviews((prev) => [...prev, ...newPreviews.filter(Boolean)]);
            setDebugInfo(
              `📁 Loaded ${newImages.filter(Boolean).length} new images`
            );
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const onFileChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  // Build panorama - Updated for FastAPI backend
  const buildPanorama = async () => {
    if (backendStatus !== "connected") {
      alert("Backend chưa sẵn sàng!");
      return;
    }

    if (images.length < MIN_IMAGES) {
      alert(`Cần ít nhất ${MIN_IMAGES} ảnh để tạo panorama!`);
      return;
    }

    setIsProcessing(true);
    setResultReady(false);
    setResultImage(null);
    setProcessingStage("Preparing...");

    try {
      const formData = new FormData();

      // Add images với key "images" thay vì "files"
      images.forEach((img) => {
        formData.append("images", img.file);
      });

      // Determine endpoint and mode
      let endpoint = "/stitch";
      let modeDescription = "Linear Panorama";

      // Auto-detection logic
      if (panoramaMode === "force360") {
        endpoint = "/create_360_panorama";
        modeDescription = "360° Panorama (Forced)";
      } else if (panoramaMode === "regular") {
        endpoint = "/stitch";
        modeDescription = "Linear Panorama (Forced)";
      } else {
        // Auto mode
        if (images.length >= IMAGES_360_THRESHOLD) {
          endpoint = "/create_360_panorama";
          modeDescription = `360° Panorama (Auto - ${images.length} images)`;
        } else {
          endpoint = "/stitch";
          modeDescription = `Linear Panorama (Auto - ${images.length} images)`;
        }
      }

      setDebugInfo(`🚀 Starting ${modeDescription}...`);
      setProcessingStage(`Creating ${modeDescription}...`);

      // Add parameters cho FastAPI Form fields
      formData.append("stitch_mode", "PANORAMA");
      formData.append("confidence_threshold", "1.0");
      formData.append("registration_resol", "0.6");
      formData.append("seam_estimation_resol", "0.1");
      formData.append("compositing_resol", "-1");

      if (endpoint === "/create_360_panorama") {
        formData.append("focal_length_factor", "0.7");
      }

      setProcessingStage("Uploading images...");

      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `HTTP Error: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (e) {
          // Nếu không parse được JSON, dùng status text
          errorMessage = response.statusText || errorMessage;
        }

        setDebugInfo(`❌ ${errorMessage}`);
        throw new Error(errorMessage);
      }

      setProcessingStage("Processing complete!");
      setDebugInfo(`✅ ${modeDescription} created successfully!`);

      // FastAPI trả về ảnh trực tiếp (binary response)
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      setResultImage(imageUrl);
      setResultReady(true);
      setProcessingStage("");
    } catch (error) {
      setDebugInfo(`❌ Error: ${error.message}`);
      setProcessingStage("Failed");
      console.error("Panorama error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (resultImage) {
      const modeInfo = getPanoramaModeInfo();
      const a = document.createElement("a");
      a.href = resultImage;
      a.download = `panorama_${modeInfo.mode
        .toLowerCase()
        .replace("°", "degree")}_${Date.now()}.jpg`;
      a.click();
    }
  };

  const clearAll = () => {
    setImages([]);
    setPreviews([]);
    setResultReady(false);
    setResultImage(null);
    setDebugInfo("");
    setProcessingStage("");
    stopCamera();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setDebugInfo(`🗑️ Removed image ${index + 1}`);
  };

  const modeInfo = getPanoramaModeInfo();

  return (
    <>
      <link
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css"
        rel="stylesheet"
      />
      <link
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        rel="stylesheet"
      />

      <div className="container py-4">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 text-center">
            <h1 className="h2 mb-3">🌍 360° Panorama Stitcher (FastAPI)</h1>
            <div className="d-flex justify-content-center flex-wrap gap-2 mb-3">
              <span
                className={`badge ${
                  backendStatus === "connected" ? "bg-success" : "bg-danger"
                }`}
              >
                {backendStatus === "connected" ? "✅ Connected" : "❌ Offline"}
              </span>
              <span className="badge bg-secondary">
                {images.length}/{MAX_IMAGES} images
              </span>
              <span className={`badge bg-${modeInfo.color}`}>
                {modeInfo.icon} {modeInfo.mode}
              </span>
              {images.length >= MIN_IMAGES && (
                <span className="badge bg-info">Ready to build</span>
              )}
            </div>

            {/* Mode Selection */}
            <div className="btn-group mb-3" role="group">
              <input
                type="radio"
                className="btn-check"
                name="panoramaMode"
                id="auto"
                value="auto"
                checked={panoramaMode === "auto"}
                onChange={(e) => setPanoramaMode(e.target.value)}
              />
              <label className="btn btn-outline-primary" htmlFor="auto">
                🤖 Auto
              </label>

              <input
                type="radio"
                className="btn-check"
                name="panoramaMode"
                id="regular"
                value="regular"
                checked={panoramaMode === "regular"}
                onChange={(e) => setPanoramaMode(e.target.value)}
              />
              <label className="btn btn-outline-primary" htmlFor="regular">
                📐 Linear
              </label>

              <input
                type="radio"
                className="btn-check"
                name="panoramaMode"
                id="force360"
                value="force360"
                checked={panoramaMode === "force360"}
                onChange={(e) => setPanoramaMode(e.target.value)}
              />
              <label className="btn btn-outline-success" htmlFor="force360">
                🌍 Force 360°
              </label>
            </div>

            <p className="text-muted small">{modeInfo.description}</p>
          </div>
        </div>

        {/* Debug Info Panel */}
        {debugInfo && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="alert alert-info">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h6 className="alert-heading mb-1">🐛 Debug Info</h6>
                    <pre className="mb-0 small">{debugInfo}</pre>
                  </div>
                  <button
                    className="btn btn-sm btn-outline-info"
                    onClick={() => setDebugInfo("")}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing Stage */}
        {processingStage && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="alert alert-primary">
                <div className="d-flex align-items-center">
                  {isProcessing && (
                    <div className="spinner-border spinner-border-sm me-2"></div>
                  )}
                  <span>{processingStage}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Camera Modal */}
        {showCamera && (
          <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.8)", zIndex: 1060 }}
          >
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    📷 Chụp Ảnh 360° ({images.length}/{MAX_IMAGES})
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={stopCamera}
                  ></button>
                </div>
                <div className="modal-body p-0">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-100"
                    style={{ height: "400px", objectFit: "cover" }}
                  />
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-success btn-lg"
                    onClick={capturePhoto}
                    disabled={images.length >= MAX_IMAGES}
                  >
                    📷{" "}
                    {images.length >= MAX_IMAGES
                      ? `Đã đủ ${MAX_IMAGES} ảnh`
                      : "Chụp"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={stopCamera}
                  >
                    ✅ Xong
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className="row mb-4">
          <div className="col-12">
            <div
              className="border-2 border-dashed rounded p-4 text-center"
              style={{
                borderColor: "#dee2e6",
                backgroundColor: "#f8f9fa",
                cursor: images.length >= MAX_IMAGES ? "not-allowed" : "pointer",
                opacity: images.length >= MAX_IMAGES ? 0.6 : 1,
              }}
              onClick={() => {
                if (images.length < MAX_IMAGES) {
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <div className="display-4 text-muted mb-2">📁</div>
              <h5 className="text-muted">
                {images.length >= MAX_IMAGES
                  ? `Đã đủ ${MAX_IMAGES} ảnh`
                  : "Add Images"}
              </h5>
              <p className="text-muted">
                {images.length >= MAX_IMAGES
                  ? "Không thể thêm ảnh nữa"
                  : `Click hoặc kéo thả ảnh (còn lại: ${
                      MAX_IMAGES - images.length
                    })`}
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*"
              multiple
              onChange={onFileChange}
              disabled={images.length >= MAX_IMAGES}
            />
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="row mb-4">
          <div className="col-12 text-center">
            <div className="btn-group" role="group">
              <button
                className="btn btn-primary"
                onClick={startCamera}
                disabled={isCameraActive || images.length >= MAX_IMAGES}
              >
                📷{" "}
                {images.length >= MAX_IMAGES
                  ? `Đã đủ ${MAX_IMAGES} ảnh`
                  : "Chụp Thêm"}
              </button>
              <button
                className="btn btn-info"
                onClick={testFeatures}
                disabled={images.length === 0}
              >
                🔍 Test Features
              </button>
              <button className="btn btn-warning" onClick={checkBackendStatus}>
                🔄 Check Backend
              </button>
            </div>
          </div>
        </div>

        {/* Image Previews */}
        {previews.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <h6>
                📸 Ảnh đã chọn ({previews.length}/{MAX_IMAGES})
              </h6>
              <div className="row g-3">
                {previews.map((preview, index) => (
                  <div key={index} className="col-6 col-md-4 col-lg-3">
                    <div className="position-relative">
                      <img
                        src={preview}
                        className="w-100 rounded"
                        style={{ aspectRatio: "4/3", objectFit: "cover" }}
                        alt={`Image ${index + 1}`}
                      />
                      <span className="position-absolute top-0 start-0 bg-primary text-white px-2 py-1 rounded-end">
                        {index + 1}
                      </span>
                      <button
                        className="position-absolute top-0 end-0 btn btn-danger btn-sm m-1"
                        onClick={() => removeImage(index)}
                        style={{ padding: "2px 6px" }}
                      >
                        ❌
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Build Button */}
        {images.length > 0 && (
          <div className="row mb-4">
            <div className="col-12 text-center">
              <button
                className={`btn btn-${modeInfo.color} btn-lg me-3`}
                onClick={buildPanorama}
                disabled={
                  backendStatus !== "connected" ||
                  images.length < MIN_IMAGES ||
                  isProcessing
                }
              >
                {isProcessing ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Creating {modeInfo.mode}...
                  </>
                ) : (
                  <>
                    {modeInfo.icon} Build {modeInfo.mode} ({images.length}{" "}
                    images)
                  </>
                )}
              </button>

              <button
                className="btn btn-outline-secondary btn-lg"
                onClick={clearAll}
                disabled={isProcessing}
              >
                🗑️ Clear All
              </button>
            </div>
          </div>
        )}

        {/* Validation Messages */}
        {images.length > 0 && images.length < MIN_IMAGES && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="alert alert-warning">
                ⚠️ Cần thêm {MIN_IMAGES - images.length} ảnh nữa để tạo panorama
              </div>
            </div>
          </div>
        )}

        {/* 360° Tips */}
        {(panoramaMode === "force360" ||
          (panoramaMode === "auto" &&
            images.length >= IMAGES_360_THRESHOLD)) && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="alert alert-success">
                <h6>🌍 360° Panorama Tips:</h6>
                <ul className="mb-0 small">
                  <li>Chụp ảnh theo vòng tròn, overlap 30-50%</li>
                  <li>Giữ camera cùng độ cao và thẳng</li>
                  <li>Tốt nhất: 8-20 ảnh cho vòng tròn đầy đủ</li>
                  <li>Cố định exposure, tắt auto-focus</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Result */}
        {resultReady && resultImage && (
          <div className="row">
            <div className="col-12 text-center">
              <div className="card">
                <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">✅ {modeInfo.mode} Result</h5>
                  <button
                    className="btn btn-light btn-sm"
                    onClick={downloadResult}
                  >
                    💾 Download
                  </button>
                </div>
                <div className="card-body">
                  <img
                    src={resultImage}
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      borderRadius: "8px",
                    }}
                    alt="Panorama Result"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backend Setup Notice */}
        {backendStatus === "error" && (
          <div className="row mt-4">
            <div className="col-12">
              <div className="alert alert-danger">
                <h6>❌ Backend Setup Required</h6>
                <p className="mb-2">
                  Start FastAPI server: <code>python run.py</code>
                </p>
                <p className="mb-0">
                  Make sure backend is running on port 5000.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </>
  );
};

export default PanoramaStitcher;
