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
  const [stream, setStream] = useState(null);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const backendUrl = "https://panorama-converter.onrender.com";

  const MAX_IMAGES = 50;
  const MIN_IMAGES = 2;

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

        // Add to main images and previews
        const newImage = { file, element: null, name: file.name };

        setImages((prev) => [...prev, newImage]);
        setPreviews((prev) => [...prev, imageUrl]);

        console.log(`Photo captured. Total: ${images.length + 1}`);
      },
      "image/jpeg",
      0.9
    );
  };

  // Handle file upload
  const handleFileSelect = (files) => {
    const fileArray = Array.from(files);

    // Check if adding these files would exceed limit
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

    if (images.length < MIN_IMAGES) {
      alert(`Cần ít nhất ${MIN_IMAGES} ảnh để tạo panorama!`);
      return;
    }

    if (images.length > MAX_IMAGES) {
      alert(`Quá nhiều ảnh! Tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }

    setIsProcessing(true);
    setResultReady(false);
    setResultImage(null);

    try {
      const formData = new FormData();

      images.forEach((img) => {
        formData.append("images", img.file);
      });

      formData.append("stitch_mode", "PANORAMA");
      formData.append("confidence_threshold", "1.0");
      formData.append("registration_resol", "0.6");
      formData.append("seam_estimation_resol", "0.1");
      formData.append("compositing_resol", "-1");
      formData.append("try_use_gpu", "false");

      const response = await fetch(`${backendUrl}/stitch`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

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
    setResultReady(false);
    setResultImage(null);
    stopCamera();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
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
              <span className="badge bg-secondary me-2">
                {images.length}/{MAX_IMAGES} images
              </span>
              {images.length >= MIN_IMAGES && (
                <span className="badge bg-info">Ready to build</span>
              )}
            </div>
          </div>
        </div>

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
                    📷 Chụp Ảnh ({images.length}/{MAX_IMAGES})
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
                    <i className="fas fa-camera me-1"></i>
                    {images.length >= MAX_IMAGES
                      ? `Đã đủ ${MAX_IMAGES} ảnh`
                      : "Chụp"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={stopCamera}
                  >
                    <i className="fas fa-times me-1"></i>
                    Xong
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
              className="border-2 border-dashed rounded p-5 text-center"
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
              <i className="fas fa-images fa-3x text-muted mb-3"></i>
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

        {/* Camera Button */}
        <div className="row mb-4">
          <div className="col-12 text-center">
            <button
              className="btn btn-primary btn-lg"
              onClick={startCamera}
              disabled={isCameraActive || images.length >= MAX_IMAGES}
            >
              <i className="fas fa-camera me-2"></i>
              {images.length >= MAX_IMAGES
                ? `Đã đủ ${MAX_IMAGES} ảnh`
                : "Chụp Thêm Ảnh"}
            </button>
          </div>
        </div>

        {/* Image Previews */}
        {previews.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <h6>
                <i className="fas fa-images me-1"></i>
                Ảnh đã chọn ({previews.length}/{MAX_IMAGES})
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
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {images.length > 0 && (
          <div className="row mb-4">
            <div className="col-12 text-center">
              <button
                className="btn btn-success btn-lg me-3"
                onClick={buildPanorama}
                disabled={
                  backendStatus !== "connected" ||
                  images.length < MIN_IMAGES ||
                  images.length > MAX_IMAGES ||
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

              <button
                className="btn btn-outline-secondary btn-lg"
                onClick={clearAll}
                disabled={isProcessing}
              >
                <i className="fas fa-trash me-1"></i>
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Validation Messages */}
        {images.length > 0 && images.length < MIN_IMAGES && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="alert alert-warning">
                <i className="fas fa-exclamation-triangle me-1"></i>
                Cần thêm {MIN_IMAGES - images.length} ảnh nữa để tạo panorama
              </div>
            </div>
          </div>
        )}

        {images.length > MAX_IMAGES && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="alert alert-danger">
                <i className="fas fa-times-circle me-1"></i>
                Quá nhiều ảnh! Xóa {images.length - MAX_IMAGES} ảnh để tiếp tục
              </div>
            </div>
          </div>
        )}

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

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </>
  );
};

export default PanoramaStitcher;
