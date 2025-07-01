import React, { useState, useRef, useEffect } from "react";

const PanoramaStitcher = () => {
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [resultImage, setResultImage] = useState(null);

  // Camera capture states
  const [showCamera, setShowCamera] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [stream, setStream] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const backendUrl = "http://localhost:5000";

  // Camera capture directions
  const captureDirections = [
    { name: "Trung tâm", instruction: "Chụp ảnh ở vị trí trung tâm" },
    { name: "Trái 45°", instruction: "Xoay trái 45° và chụp" },
    { name: "Phải 45°", instruction: "Xoay phải 45° và chụp" },
    { name: "Trái 90°", instruction: "Xoay trái 90° và chụp" },
    { name: "Phải 90°", instruction: "Xoay phải 90° và chụp" },
    { name: "Lên trên", instruction: "Nghiêng camera lên trên và chụp" },
    { name: "Xuống dưới", instruction: "Nghiêng camera xuống dưới và chụp" },
  ];

  // Check backend status
  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      setBackendStatus("checking");
      const response = await fetch(`${backendUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        setBackendStatus("connected");
      } else {
        setBackendStatus("error");
      }
    } catch (error) {
      setBackendStatus("error");
    }
  };

  // Initialize camera
  const startCamera = async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Trình duyệt không hỗ trợ camera!");
        return;
      }

      // Try different camera configurations
      let mediaStream;

      try {
        // First try: Back camera with high resolution
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
            facingMode: "environment",
          },
        });
      } catch (backCameraError) {
        try {
          // Second try: Front camera
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              facingMode: "user",
            },
          });
        } catch (frontCameraError) {
          // Third try: Any available camera with basic settings
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { min: 320, ideal: 640, max: 1920 },
              height: { min: 240, ideal: 480, max: 1080 },
            },
          });
        }
      }

      if (videoRef.current && mediaStream) {
        videoRef.current.srcObject = mediaStream;

        // Wait for video to be ready
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = resolve;
        });

        setStream(mediaStream);
        setIsCameraActive(true);
        setCurrentStep(0);
        setCapturedPhotos([]);
        setShowCamera(true);
      }
    } catch (error) {
      console.error("Camera error:", error);
      let errorMessage = "Không thể truy cập camera: ";

      if (error.name === "NotAllowedError") {
        errorMessage +=
          "Bạn đã từ chối quyền truy cập camera. Vui lòng cho phép camera trong cài đặt trình duyệt.";
      } else if (error.name === "NotFoundError") {
        errorMessage += "Không tìm thấy camera nào trên thiết bị.";
      } else if (error.name === "NotSupportedError") {
        errorMessage += "Trình duyệt không hỗ trợ tính năng này.";
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
    setCurrentStep(0);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        const file = new File([blob], `capture_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const imageUrl = URL.createObjectURL(blob);

        setCapturedPhotos((prev) => [
          ...prev,
          {
            file,
            preview: imageUrl,
            direction: captureDirections[currentStep].name,
            step: currentStep,
          },
        ]);

        // Move to next step or finish
        if (currentStep < captureDirections.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          // Finished capturing all directions
          finishCapture();
        }
      },
      "image/jpeg",
      0.9
    );
  };

  const finishCapture = () => {
    // Convert captured photos to the format expected by the stitching function
    const capturedImages = capturedPhotos.map((photo, index) => ({
      file: photo.file,
      element: null,
      name: `captured_${index + 1}.jpg`,
    }));

    // Add to existing images
    setImages((prev) => [...prev, ...capturedImages]);
    setPreviews((prev) => [
      ...prev,
      ...capturedPhotos.map((photo) => photo.preview),
    ]);

    stopCamera();
    alert(`Đã chụp xong ${capturedPhotos.length + 1} ảnh!`);
  };

  const retakePhoto = () => {
    if (currentStep > 0) {
      const newCapturedPhotos = capturedPhotos.slice(0, -1);
      setCapturedPhotos(newCapturedPhotos);
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle file upload
  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);
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

  // Build panorama
  const buildPanorama = async () => {
    if (backendStatus !== "connected") {
      alert("Backend chưa sẵn sàng!");
      return;
    }

    if (images.length < 2) {
      alert("Cần ít nhất 2 ảnh!");
      return;
    }

    setIsProcessing(true);
    setResultReady(false);
    setResultImage(null);

    try {
      const formData = new FormData();

      // Add images
      images.forEach((img) => {
        formData.append("images", img.file);
      });

      // Add default settings
      formData.append("stitch_mode", "PANORAMA");
      formData.append("confidence_threshold", "1.0");
      formData.append("registration_resol", "0.6");
      formData.append("seam_estimation_resol", "0.1");
      formData.append("compositing_resol", "-1");
      formData.append("try_use_gpu", "false");

      // Send to Flask backend
      const response = await fetch(`${backendUrl}/stitch`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      // Get result
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      setResultImage(imageUrl);
      setResultReady(true);
    } catch (error) {
      alert("Lỗi: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (resultImage) {
      const a = document.createElement("a");
      a.href = resultImage;
      a.download = `panorama_${Date.now()}.jpg`;
      a.click();
    }
  };

  const clearAll = () => {
    setImages([]);
    setPreviews([]);
    setCapturedPhotos([]);
    setResultReady(false);
    setResultImage(null);
    setCurrentStep(0);
    stopCamera();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

      <div className="container py-5">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 text-center">
            <h1 className="h2 mb-3">📸 Panorama Stitcher</h1>
            <div>
              <span
                className={`badge ${
                  backendStatus === "connected" ? "bg-success" : "bg-danger"
                } me-2`}
              >
                {backendStatus === "connected" ? "Connected" : "Offline"}
              </span>
              <span className="badge bg-secondary">{images.length} images</span>
            </div>
          </div>
        </div>

        {/* Camera Modal */}
        {showCamera && (
          <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    📷 Chụp Ảnh Panorama - Bước {currentStep + 1}/
                    {captureDirections.length}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={stopCamera}
                  ></button>
                </div>
                <div className="modal-body p-0">
                  <div className="position-relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-100"
                      style={{ height: "400px", objectFit: "cover" }}
                    />

                    {/* Overlay Guide */}
                    <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
                      <div className="bg-dark bg-opacity-75 text-white p-4 rounded text-center">
                        <h4 className="text-warning mb-2">
                          {captureDirections[currentStep].name}
                        </h4>
                        <p className="mb-0">
                          {captureDirections[currentStep].instruction}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={retakePhoto}
                    disabled={currentStep === 0}
                  >
                    <i className="fas fa-undo me-1"></i>
                    Chụp Lại
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={capturePhoto}
                  >
                    <i className="fas fa-camera me-1"></i>
                    Chụp ({currentStep + 1}/{captureDirections.length})
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={stopCamera}
                  >
                    <i className="fas fa-times me-1"></i>
                    Dừng
                  </button>
                </div>

                {/* Progress */}
                <div className="px-3 pb-3">
                  <div className="progress">
                    <div
                      className="progress-bar bg-success"
                      style={{
                        width: `${
                          ((currentStep + 1) / captureDirections.length) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                  <small className="text-muted">
                    Tiến trình: {currentStep + 1}/{captureDirections.length}
                  </small>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div className="row mb-4">
          <div className="col-12">
            <div
              className="border-2 border-dashed rounded p-5 text-center"
              style={{
                borderColor: "#dee2e6",
                backgroundColor: "#f8f9fa",
                cursor: "pointer",
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <i className="fas fa-images fa-3x text-muted mb-3"></i>
              <h5 className="text-muted">Add Images</h5>
              <p className="text-muted">Click or drag & drop multiple images</p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*"
              multiple
              onChange={onFileChange}
            />
          </div>
        </div>

        {/* Camera Button - Separate Row */}
        <div className="row mb-4">
          <div className="col-12 text-center">
            <button
              className="btn btn-outline-primary btn-lg"
              onClick={startCamera}
              disabled={isCameraActive}
            >
              <i className="fas fa-camera me-2"></i>
              Chụp Ảnh Trực Tiếp
            </button>
          </div>
        </div>

        {/* Captured Photos Preview */}
        {capturedPhotos.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <h6 className="text-success">
                <i className="fas fa-camera me-1"></i>
                Ảnh đã chụp ({capturedPhotos.length})
              </h6>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {capturedPhotos.map((photo, index) => (
                  <div key={index} className="position-relative">
                    <img
                      src={photo.preview}
                      style={{
                        width: "80px",
                        height: "60px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                      alt={photo.direction}
                    />
                    <span
                      className="position-absolute top-0 start-0 bg-success text-white px-1 rounded-end"
                      style={{ fontSize: "10px" }}
                    >
                      {photo.direction}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Image Previews */}
        {previews.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <h6>
                <i className="fas fa-images me-1"></i>
                Tất cả ảnh ({previews.length})
              </h6>
              <div className="d-flex flex-wrap gap-3">
                {previews.map((preview, index) => (
                  <div key={index} className="position-relative">
                    <img
                      src={preview}
                      style={{
                        width: "120px",
                        height: "80px",
                        objectFit: "cover",
                        borderRadius: "8px",
                      }}
                      alt={`Image ${index + 1}`}
                    />
                    <span className="position-absolute top-0 start-0 bg-primary text-white px-2 py-1 rounded-end">
                      {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="row mb-4">
          <div className="col-12 text-center">
            <button
              className="btn btn-primary btn-lg me-3"
              onClick={buildPanorama}
              disabled={
                backendStatus !== "connected" ||
                images.length < 2 ||
                isProcessing
              }
            >
              {isProcessing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Building Panorama...
                </>
              ) : (
                <>
                  <i className="fas fa-magic me-1"></i>
                  Build Panorama ({images.length} images)
                </>
              )}
            </button>

            {images.length > 0 && (
              <button
                className="btn btn-outline-secondary btn-lg"
                onClick={clearAll}
                disabled={isProcessing}
              >
                <i className="fas fa-trash me-1"></i>
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Result */}
        {resultReady && resultImage && (
          <div className="row">
            <div className="col-12 text-center">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <i className="fas fa-check-circle text-success me-1"></i>
                    Panorama Result
                  </h5>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={downloadResult}
                  >
                    <i className="fas fa-download me-1"></i>
                    Download
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
              <div className="alert alert-warning">
                <h6>
                  <i className="fas fa-exclamation-triangle me-1"></i>
                  Backend Setup Required
                </h6>
                <p className="mb-0">
                  Start Flask server: <code>python app.py</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Hidden Canvas for Photo Capture */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </>
  );
};

export default PanoramaStitcher;
