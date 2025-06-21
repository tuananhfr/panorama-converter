import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  RotateCcw,
  Download,
  Play,
  Square,
  Zap,
  Settings,
} from "lucide-react";

const PanoramaCameraApp = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [targetAngle, setTargetAngle] = useState(0);
  const [panoramaMode, setPanoramaMode] = useState("manual"); // 'manual' or 'auto'
  const [captureInterval, setCaptureInterval] = useState(null);
  const [deviceOrientation, setDeviceOrientation] = useState({
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalPanorama, setFinalPanorama] = useState(null);

  // Khởi tạo camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "environment", // Camera sau
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
      }
    } catch (error) {
      console.error("Lỗi khi truy cập camera:", error);
      alert(
        "Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera."
      );
    }
  };

  // Dừng camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Theo dõi hướng thiết bị (gyroscope)
  useEffect(() => {
    const handleOrientation = (event) => {
      setDeviceOrientation({
        alpha: event.alpha || 0, // Góc quay quanh trục Z (0-360)
        beta: event.beta || 0, // Góc nghiêng trước sau (-180 đến 180)
        gamma: event.gamma || 0, // Góc nghiêng trái phải (-90 đến 90)
      });
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleOrientation);
      return () =>
        window.removeEventListener("deviceorientation", handleOrientation);
    }
  }, []);

  // Chụp ảnh đơn lẻ
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  // Chụp ảnh thủ công
  const handleManualCapture = () => {
    const imageData = captureFrame();
    if (imageData) {
      const newImage = {
        id: Date.now(),
        data: imageData,
        angle: Math.round(deviceOrientation.alpha),
        timestamp: new Date().toISOString(),
      };
      setCapturedImages((prev) => [...prev, newImage]);
    }
  };

  // Bắt đầu chụp tự động
  const startAutoCapture = () => {
    setIsCapturing(true);
    const interval = setInterval(() => {
      const imageData = captureFrame();
      if (imageData) {
        const newImage = {
          id: Date.now(),
          data: imageData,
          angle: Math.round(deviceOrientation.alpha),
          timestamp: new Date().toISOString(),
        };
        setCapturedImages((prev) => [...prev, newImage]);
      }
    }, 1000); // Chụp mỗi giây

    setCaptureInterval(interval);
  };

  // Dừng chụp tự động
  const stopAutoCapture = () => {
    setIsCapturing(false);
    if (captureInterval) {
      clearInterval(captureInterval);
      setCaptureInterval(null);
    }
  };

  // Xóa tất cả ảnh đã chụp
  const clearImages = () => {
    setCapturedImages([]);
    setFinalPanorama(null);
  };

  // Ghép ảnh panorama (đơn giản - xếp ngang)
  const stitchPanorama = async () => {
    if (capturedImages.length < 2) {
      alert("Cần ít nhất 2 ảnh để tạo panorama");
      return;
    }

    setIsProcessing(true);

    try {
      // Sắp xếp ảnh theo góc
      const sortedImages = [...capturedImages].sort(
        (a, b) => a.angle - b.angle
      );

      // Tạo canvas lớn để ghép ảnh
      const stitchCanvas = document.createElement("canvas");
      const ctx = stitchCanvas.getContext("2d");

      // Load ảnh đầu tiên để lấy kích thước
      const firstImg = new Image();
      firstImg.src = sortedImages[0].data;

      await new Promise((resolve) => {
        firstImg.onload = resolve;
      });

      const imgWidth = firstImg.width;
      const imgHeight = firstImg.height;
      const overlapWidth = imgWidth * 0.2; // Overlap 20%

      stitchCanvas.width =
        imgWidth * sortedImages.length -
        overlapWidth * (sortedImages.length - 1);
      stitchCanvas.height = imgHeight;

      // Ghép từng ảnh
      for (let i = 0; i < sortedImages.length; i++) {
        const img = new Image();
        img.src = sortedImages[i].data;

        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const x = i * (imgWidth - overlapWidth);
        ctx.drawImage(img, x, 0, imgWidth, imgHeight);
      }

      const panoramaData = stitchCanvas.toDataURL("image/jpeg", 0.9);
      setFinalPanorama(panoramaData);
    } catch (error) {
      console.error("Lỗi khi ghép panorama:", error);
      alert("Có lỗi xảy ra khi ghép ảnh");
    }

    setIsProcessing(false);
  };

  // Tải xuống panorama
  const downloadPanorama = () => {
    if (!finalPanorama) return;

    const link = document.createElement("a");
    link.href = finalPanorama;
    link.download = `panorama-360-${Date.now()}.jpg`;
    link.click();
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (captureInterval) clearInterval(captureInterval);
    };
  }, []);

  const compassStyle = {
    transform: `rotate(${deviceOrientation.alpha}deg)`,
    transformOrigin: "bottom center",
  };

  return (
    <div className="min-vh-100 bg-dark text-white">
      {/* Header */}
      <div className="bg-secondary p-3">
        <div className="d-flex align-items-center justify-content-between">
          <h1 className="h4 mb-0 d-flex align-items-center">
            <Camera className="me-2" size={24} />
            Panorama 360°
          </h1>
          <div className="d-flex align-items-center">
            <small className="text-muted">
              Góc: {Math.round(deviceOrientation.alpha)}°
            </small>
          </div>
        </div>
      </div>

      {/* Camera View */}
      <div className="position-relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-100"
          style={{ height: "250px", objectFit: "cover" }}
        />

        {/* Overlay hướng dẫn */}
        <div
          className="position-absolute top-0 start-0 w-100 h-100"
          style={{ pointerEvents: "none" }}
        >
          {/* Đường dẫn hướng */}
          <div className="position-absolute top-0 start-50 translate-middle-x mt-3">
            <div className="bg-dark bg-opacity-75 px-3 py-1 rounded-pill">
              <small>Xoay từ từ theo chiều kim đồng hồ</small>
            </div>
          </div>

          {/* Compass */}
          <div className="position-absolute top-0 end-0 mt-3 me-3">
            <div
              className="bg-dark bg-opacity-75 rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: "60px", height: "60px" }}
            >
              <div
                className="bg-danger rounded-pill"
                style={{
                  width: "4px",
                  height: "24px",
                  ...compassStyle,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="p-3">
        {/* Mode Selection */}
        <div className="row g-2 mb-3">
          <div className="col-6">
            <button
              onClick={() => setPanoramaMode("manual")}
              className={`btn w-100 d-flex align-items-center justify-content-center ${
                panoramaMode === "manual"
                  ? "btn-primary"
                  : "btn-outline-secondary"
              }`}
            >
              <Camera className="me-2" size={16} />
              Thủ công
            </button>
          </div>
          <div className="col-6">
            <button
              onClick={() => setPanoramaMode("auto")}
              className={`btn w-100 d-flex align-items-center justify-content-center ${
                panoramaMode === "auto"
                  ? "btn-primary"
                  : "btn-outline-secondary"
              }`}
            >
              <Play className="me-2" size={16} />
              Tự động
            </button>
          </div>
        </div>

        {/* Capture Controls */}
        <div className="row g-2 mb-3">
          <div className="col">
            {panoramaMode === "manual" ? (
              <button
                onClick={handleManualCapture}
                className="btn btn-danger w-100 d-flex align-items-center justify-content-center fw-bold"
              >
                <Camera className="me-2" size={20} />
                Chụp ({capturedImages.length})
              </button>
            ) : (
              <button
                onClick={isCapturing ? stopAutoCapture : startAutoCapture}
                className={`btn w-100 d-flex align-items-center justify-content-center fw-bold ${
                  isCapturing ? "btn-danger" : "btn-success"
                }`}
              >
                {isCapturing ? (
                  <Square className="me-2" size={20} />
                ) : (
                  <Play className="me-2" size={20} />
                )}
                {isCapturing ? `Dừng (${capturedImages.length})` : "Bắt đầu"}
              </button>
            )}
          </div>

          <div className="col-auto">
            <button
              onClick={clearImages}
              className="btn btn-outline-secondary"
              disabled={capturedImages.length === 0}
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>

        {/* Process Panorama */}
        {capturedImages.length >= 2 && (
          <div className="mb-3">
            <button
              onClick={stitchPanorama}
              disabled={isProcessing}
              className="btn btn-warning w-100 d-flex align-items-center justify-content-center fw-bold"
            >
              <Zap className="me-2" size={20} />
              {isProcessing ? "Đang xử lý..." : "Tạo Panorama"}
            </button>
          </div>
        )}

        {/* Download Panorama */}
        {finalPanorama && (
          <div className="mb-3">
            <button
              onClick={downloadPanorama}
              className="btn btn-success w-100 d-flex align-items-center justify-content-center fw-bold"
            >
              <Download className="me-2" size={20} />
              Tải xuống Panorama
            </button>
          </div>
        )}
      </div>

      {/* Preview Captured Images */}
      {capturedImages.length > 0 && (
        <div className="p-3 border-top border-secondary">
          <h6 className="mb-2">Ảnh đã chụp ({capturedImages.length})</h6>
          <div className="d-flex gap-2 overflow-auto">
            {capturedImages.map((img) => (
              <div key={img.id} className="flex-shrink-0 text-center">
                <img
                  src={img.data}
                  alt={`Frame ${img.id}`}
                  className="border border-secondary rounded"
                  style={{ width: "64px", height: "64px", objectFit: "cover" }}
                />
                <div className="small mt-1">{img.angle}°</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Panorama Preview */}
      {finalPanorama && (
        <div className="p-3 border-top border-secondary">
          <h6 className="mb-2">Panorama 360°</h6>
          <div className="bg-secondary rounded p-2">
            <img
              src={finalPanorama}
              alt="Panorama 360°"
              className="w-100 rounded"
              style={{ height: "128px", objectFit: "cover" }}
            />
          </div>
        </div>
      )}

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="d-none" />
    </div>
  );
};

export default PanoramaCameraApp;
