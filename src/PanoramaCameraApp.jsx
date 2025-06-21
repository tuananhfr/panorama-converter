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
  const [recommendedAngles] = useState([
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
  ]);
  const [capturedAngles, setCapturedAngles] = useState([]);
  const [nextRecommendedAngle, setNextRecommendedAngle] = useState(0);
  const [angleProgress, setAngleProgress] = useState(0);

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
      const newOrientation = {
        alpha: event.alpha || 0, // Góc quay quanh trục Z (0-360)
        beta: event.beta || 0, // Góc nghiêng trước sau (-180 đến 180)
        gamma: event.gamma || 0, // Góc nghiêng trái phải (-90 đến 90)
      };
      setDeviceOrientation(newOrientation);

      // Tính toán góc tiếp theo được đề xuất
      updateRecommendedAngle(newOrientation.alpha);
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleOrientation);
      return () =>
        window.removeEventListener("deviceorientation", handleOrientation);
    }
  }, [capturedAngles]);

  // Cập nhật góc đề xuất tiếp theo
  const updateRecommendedAngle = (currentAlpha) => {
    const currentAngle = Math.round(currentAlpha);

    // Tìm góc chưa chụp gần nhất
    const unCapturedAngles = recommendedAngles.filter(
      (angle) =>
        !capturedAngles.some((captured) => Math.abs(captured - angle) <= 15)
    );

    if (unCapturedAngles.length > 0) {
      // Tìm góc gần nhất với vị trí hiện tại
      const nextAngle = unCapturedAngles.reduce((closest, angle) => {
        const currentDistance = Math.min(
          Math.abs(currentAngle - angle),
          Math.abs(currentAngle - angle + 360),
          Math.abs(currentAngle - angle - 360)
        );
        const closestDistance = Math.min(
          Math.abs(currentAngle - closest),
          Math.abs(currentAngle - closest + 360),
          Math.abs(currentAngle - closest - 360)
        );
        return currentDistance < closestDistance ? angle : closest;
      });

      setNextRecommendedAngle(nextAngle);
    }

    // Tính toán progress
    const progress = (capturedAngles.length / recommendedAngles.length) * 100;
    setAngleProgress(progress);
  };

  // Kiểm tra xem góc hiện tại có phù hợp để chụp không
  const isGoodAngleToCapture = () => {
    const currentAngle = Math.round(deviceOrientation.alpha);
    const tolerance = 15; // Dung sai 15 độ

    return recommendedAngles.some(
      (recommendedAngle) =>
        Math.abs(currentAngle - recommendedAngle) <= tolerance &&
        !capturedAngles.some(
          (captured) => Math.abs(captured - recommendedAngle) <= tolerance
        )
    );
  };

  // Lấy góc gần nhất chưa chụp
  const getNearestUnCapturedAngle = () => {
    const currentAngle = Math.round(deviceOrientation.alpha);
    const unCapturedAngles = recommendedAngles.filter(
      (angle) =>
        !capturedAngles.some((captured) => Math.abs(captured - angle) <= 15)
    );

    if (unCapturedAngles.length === 0) return null;

    return unCapturedAngles.reduce((closest, angle) => {
      const currentDistance = Math.min(
        Math.abs(currentAngle - angle),
        Math.abs(currentAngle - angle + 360),
        Math.abs(currentAngle - angle - 360)
      );
      const closestDistance = Math.min(
        Math.abs(currentAngle - closest),
        Math.abs(currentAngle - closest + 360),
        Math.abs(currentAngle - closest - 360)
      );
      return currentDistance < closestDistance ? angle : closest;
    });
  };

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
      const currentAngle = Math.round(deviceOrientation.alpha);
      const newImage = {
        id: Date.now(),
        data: imageData,
        angle: currentAngle,
        timestamp: new Date().toISOString(),
      };
      setCapturedImages((prev) => [...prev, newImage]);
      setCapturedAngles((prev) => [...prev, currentAngle]);
    }
  };

  // Bắt đầu chụp tự động
  const startAutoCapture = () => {
    setIsCapturing(true);
    const interval = setInterval(() => {
      // Chỉ chụp nếu đang ở góc phù hợp
      if (isGoodAngleToCapture()) {
        const imageData = captureFrame();
        if (imageData) {
          const currentAngle = Math.round(deviceOrientation.alpha);
          const newImage = {
            id: Date.now(),
            data: imageData,
            angle: currentAngle,
            timestamp: new Date().toISOString(),
          };
          setCapturedImages((prev) => [...prev, newImage]);
          setCapturedAngles((prev) => [...prev, currentAngle]);
        }
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
    setCapturedAngles([]);
    setFinalPanorama(null);
    setAngleProgress(0);
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

  // Tải xuống ảnh đơn lẻ
  const downloadSingleImage = (imageData, angle, index) => {
    const link = document.createElement("a");
    link.href = imageData;
    link.download = `panorama-frame-${index + 1}-${angle}deg-${Date.now()}.jpg`;
    link.click();
  };

  // Tải xuống tất cả ảnh đã chụp
  const downloadAllImages = () => {
    if (capturedImages.length === 0) return;

    capturedImages.forEach((img, index) => {
      setTimeout(() => {
        downloadSingleImage(img.data, img.angle, index);
      }, index * 100); // Delay giữa các download
    });
  };

  // Lưu vào IndexedDB (local storage lớn hơn)
  const saveToIndexedDB = async () => {
    try {
      // Mở IndexedDB
      const request = indexedDB.open("PanoramaApp", 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("images")) {
          db.createObjectStore("images", { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["images"], "readwrite");
        const store = transaction.objectStore("images");

        capturedImages.forEach((img) => {
          store.put({
            id: img.id,
            data: img.data,
            angle: img.angle,
            timestamp: img.timestamp,
          });
        });

        transaction.oncomplete = () => {
          alert(`Đã lưu ${capturedImages.length} ảnh vào storage!`);
        };
      };
    } catch (error) {
      console.error("Lỗi lưu vào IndexedDB:", error);
    }
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
            <small className="text-muted me-3">
              {capturedImages.length}/{recommendedAngles.length} ảnh
            </small>
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
                disabled={!isGoodAngleToCapture() && capturedImages.length > 0}
                className={`btn w-100 d-flex align-items-center justify-content-center fw-bold ${
                  isGoodAngleToCapture() ? "btn-success" : "btn-danger"
                }`}
              >
                <Camera className="me-2" size={20} />
                {isGoodAngleToCapture()
                  ? "📷 Chụp ngay!"
                  : `Chụp (${capturedImages.length})`}
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

        {/* Angle Guide */}
        <div className="mb-3">
          <div className="card bg-secondary">
            <div className="card-body p-3">
              <h6 className="card-title mb-2 d-flex align-items-center">
                🧭 Hướng dẫn góc chụp
              </h6>

              {/* Progress bar tổng quan */}
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <small>Tiến độ hoàn thành</small>
                  <small>
                    {capturedImages.length}/{recommendedAngles.length}
                  </small>
                </div>
                <div className="progress">
                  <div
                    className="progress-bar bg-success"
                    style={{ width: `${angleProgress}%` }}
                  />
                </div>
              </div>

              {/* Grid góc chụp */}
              <div className="row g-1">
                {recommendedAngles.map((angle, index) => {
                  const isCaptured = capturedAngles.some(
                    (captured) => Math.abs(captured - angle) <= 15
                  );
                  const isNext = angle === getNearestUnCapturedAngle();

                  return (
                    <div key={index} className="col-3 col-md-2">
                      <div
                        className={`text-center p-1 rounded small ${
                          isCaptured
                            ? "bg-success text-white"
                            : isNext
                            ? "bg-warning text-dark"
                            : "bg-dark text-muted"
                        }`}
                        style={{ fontSize: "11px" }}
                      >
                        {isCaptured ? "✅" : isNext ? "🎯" : "⭕"} {angle}°
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hướng dẫn tiếp theo */}
              {getNearestUnCapturedAngle() !== null && (
                <div className="mt-2 text-center">
                  <small className="text-warning">
                    <strong>
                      Tiếp theo: Xoay đến {getNearestUnCapturedAngle()}°
                    </strong>
                  </small>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Download All Images */}
        {capturedImages.length > 0 && (
          <div className="mb-3">
            <div className="row g-2">
              <div className="col-6">
                <button
                  onClick={downloadAllImages}
                  className="btn btn-info w-100 d-flex align-items-center justify-content-center"
                >
                  <Download className="me-2" size={16} />
                  Tải tất cả ảnh
                </button>
              </div>
              <div className="col-6">
                <button
                  onClick={saveToIndexedDB}
                  className="btn btn-secondary w-100 d-flex align-items-center justify-content-center"
                >
                  💾 Lưu local
                </button>
              </div>
            </div>
          </div>
        )}

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
            {capturedImages.map((img, index) => (
              <div
                key={img.id}
                className="flex-shrink-0 text-center position-relative"
              >
                <img
                  src={img.data}
                  alt={`Frame ${img.id}`}
                  className="border border-secondary rounded"
                  style={{ width: "64px", height: "64px", objectFit: "cover" }}
                />
                <div className="small mt-1">{img.angle}°</div>
                {/* Nút download từng ảnh */}
                <button
                  onClick={() =>
                    downloadSingleImage(img.data, img.angle, index)
                  }
                  className="btn btn-sm btn-outline-light position-absolute top-0 end-0"
                  style={{ fontSize: "10px", padding: "2px 4px" }}
                  title="Tải ảnh này"
                >
                  ⬇️
                </button>
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
