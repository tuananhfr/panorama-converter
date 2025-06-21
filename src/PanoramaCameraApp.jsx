import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, RotateCcw, Download, Play, Square, Pause } from "lucide-react";

const PanoramaCameraApp = ({ onBack }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const panoramaCanvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [deviceOrientation, setDeviceOrientation] = useState({
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const [startAngle, setStartAngle] = useState(null);
  const [currentPanoramaWidth, setCurrentPanoramaWidth] = useState(0);
  const [recordingFrames, setRecordingFrames] = useState(0);
  const [progress, setProgress] = useState(0);
  const [finalPanorama, setFinalPanorama] = useState(null);
  const [lastCapturedAngle, setLastCapturedAngle] = useState(null);
  const [captureInterval, setCaptureInterval] = useState(null);
  const [panoramaHeight, setPanoramaHeight] = useState(480);

  // Khởi tạo camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "environment",
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

  // Theo dõi hướng thiết bị
  useEffect(() => {
    const handleOrientation = (event) => {
      setDeviceOrientation({
        alpha: event.alpha || 0,
        beta: event.beta || 0,
        gamma: event.gamma || 0,
      });
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener("deviceorientation", handleOrientation);
      return () =>
        window.removeEventListener("deviceorientation", handleOrientation);
    }
  }, []);

  // Tính toán khoảng cách góc
  const getAngleDifference = (angle1, angle2) => {
    let diff = Math.abs(angle1 - angle2);
    if (diff > 180) {
      diff = 360 - diff;
    }
    return diff;
  };

  // Khởi tạo panorama canvas
  const initializePanoramaCanvas = () => {
    const canvas = panoramaCanvasRef.current;
    if (!canvas || !videoRef.current) return;

    const ctx = canvas.getContext("2d");
    const video = videoRef.current;

    // Tính toán kích thước panorama cho 360°
    const videoAspectRatio = video.videoWidth / video.videoHeight;
    const frameWidth = 320; // Width của mỗi frame trong panorama
    const totalWidth = frameWidth * 36; // 360° / 10° per frame = 36 frames

    canvas.width = totalWidth;
    canvas.height = panoramaHeight;
    setPanoramaHeight(panoramaHeight);

    // Clear canvas với background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    setCurrentPanoramaWidth(0);
  };

  // Capture frame vào panorama
  const captureFrameToPanorama = useCallback(() => {
    if (!videoRef.current || !panoramaCanvasRef.current || isPaused) return;

    const video = videoRef.current;
    const panoramaCanvas = panoramaCanvasRef.current;
    const tempCanvas = canvasRef.current;

    if (!tempCanvas) return;

    const ctx = panoramaCanvas.getContext("2d");
    const tempCtx = tempCanvas.getContext("2d");

    // Capture current video frame
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    tempCtx.drawImage(video, 0, 0);

    // Tính toán vị trí trong panorama
    const currentAngle = deviceOrientation.alpha;
    let angleDiff = 0;

    if (lastCapturedAngle !== null) {
      angleDiff = getAngleDifference(currentAngle, lastCapturedAngle);
    }

    // Chỉ thêm frame nếu đã xoay đủ góc (khoảng 2-3 độ)
    if (lastCapturedAngle === null || angleDiff >= 2) {
      const frameWidth = 320;
      const frameHeight = panoramaHeight;

      // Vẽ frame vào panorama
      const xPosition = currentPanoramaWidth;

      // Scale và vẽ video frame
      ctx.drawImage(
        tempCanvas,
        0,
        0,
        tempCanvas.width,
        tempCanvas.height,
        xPosition,
        0,
        frameWidth,
        frameHeight
      );

      setCurrentPanoramaWidth((prev) => prev + frameWidth);
      setLastCapturedAngle(currentAngle);
      setRecordingFrames((prev) => prev + 1);

      // Tính progress dựa trên góc đã quét
      if (startAngle !== null) {
        let totalAngle = getAngleDifference(currentAngle, startAngle);
        if (currentAngle < startAngle) totalAngle = 360 - totalAngle;
        const progressPercent = Math.min((totalAngle / 360) * 100, 100);
        setProgress(progressPercent);

        // Tự động dừng khi hoàn thành 360°
        if (progressPercent >= 95) {
          stopRecording();
        }
      }
    }
  }, [
    deviceOrientation.alpha,
    lastCapturedAngle,
    currentPanoramaWidth,
    startAngle,
    isPaused,
  ]);

  // Bắt đầu recording panorama
  const startRecording = () => {
    if (!videoRef.current) return;

    setIsRecording(true);
    setIsPaused(false);
    setStartAngle(deviceOrientation.alpha);
    setLastCapturedAngle(null);
    setProgress(0);
    setRecordingFrames(0);

    initializePanoramaCanvas();

    // Capture frames với tần suất cao
    const interval = setInterval(captureFrameToPanorama, 100); // 10 FPS
    setCaptureInterval(interval);
  };

  // Dừng recording
  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);

    if (captureInterval) {
      clearInterval(captureInterval);
      setCaptureInterval(null);
    }

    // Tạo final panorama
    finalizePanorama();
  };

  // Pause/Resume recording
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Tạo panorama cuối cùng
  const finalizePanorama = () => {
    const canvas = panoramaCanvasRef.current;
    if (!canvas) return;

    // Crop panorama to actual width
    const finalCanvas = document.createElement("canvas");
    const finalCtx = finalCanvas.getContext("2d");

    finalCanvas.width = currentPanoramaWidth;
    finalCanvas.height = panoramaHeight;

    finalCtx.drawImage(
      canvas,
      0,
      0,
      currentPanoramaWidth,
      panoramaHeight,
      0,
      0,
      currentPanoramaWidth,
      panoramaHeight
    );

    const panoramaData = finalCanvas.toDataURL("image/jpeg", 0.9);
    setFinalPanorama(panoramaData);
  };

  // Reset tất cả
  const resetPanorama = () => {
    setIsRecording(false);
    setIsPaused(false);
    setStartAngle(null);
    setLastCapturedAngle(null);
    setProgress(0);
    setRecordingFrames(0);
    setCurrentPanoramaWidth(0);
    setFinalPanorama(null);

    if (captureInterval) {
      clearInterval(captureInterval);
      setCaptureInterval(null);
    }

    // Clear panorama canvas
    const canvas = panoramaCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Download panorama
  const downloadPanorama = () => {
    if (!finalPanorama) return;

    const link = document.createElement("a");
    link.href = finalPanorama;
    link.download = `panorama-360-${Date.now()}.jpg`;
    link.click();
  };

  // Tính toán speed recommendation
  const getSpeedRecommendation = () => {
    if (!isRecording) return "";

    const currentAngle = deviceOrientation.alpha;
    if (lastCapturedAngle === null) return "Bắt đầu xoay từ từ...";

    const angleDiff = getAngleDifference(currentAngle, lastCapturedAngle);

    if (angleDiff < 1) return "🐌 Xoay nhanh hơn";
    if (angleDiff > 5) return "🏃 Xoay chậm lại";
    return "✅ Tốc độ hoàn hảo";
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (captureInterval) clearInterval(captureInterval);
    };
  }, []);

  return (
    <div className="min-vh-100 bg-dark text-white">
      {/* Header */}
      <div className="bg-secondary p-3">
        <div className="d-flex align-items-center justify-content-between">
          {onBack && (
            <button onClick={onBack} className="btn btn-outline-light btn-sm">
              ← Về trang chính
            </button>
          )}
          <h1 className="h5 mb-0 d-flex align-items-center mx-auto">
            <Camera className="me-2" size={20} />
            Panorama 360° Live
          </h1>
          <div style={{ width: "100px" }}></div>
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
          style={{ height: "300px", objectFit: "cover" }}
        />

        {/* Recording Overlay */}
        <div
          className="position-absolute top-0 start-0 w-100 h-100"
          style={{ pointerEvents: "none" }}
        >
          {/* Progress và hướng dẫn */}
          <div className="position-absolute top-0 start-50 translate-middle-x mt-2">
            <div className="bg-dark bg-opacity-75 px-3 py-2 rounded text-center">
              {isRecording ? (
                <div>
                  <div className="d-flex align-items-center justify-content-center mb-1">
                    <span className="badge bg-danger me-2">🔴 REC</span>
                    <div
                      className="progress me-2"
                      style={{ width: "120px", height: "8px" }}
                    >
                      <div
                        className="progress-bar bg-success"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <small>{Math.round(progress)}%</small>
                  </div>
                  <small className="text-warning">
                    {getSpeedRecommendation()}
                  </small>
                </div>
              ) : (
                <small className="text-info">
                  📱 Giữ thiết bị ngang, nhấn REC và xoay 360°
                </small>
              )}
            </div>
          </div>

          {/* Compass indicator */}
          <div className="position-absolute top-0 end-0 mt-2 me-2">
            <div
              className="bg-dark bg-opacity-75 rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: "60px", height: "60px" }}
            >
              <div className="text-center">
                <small style={{ fontSize: "10px" }}>
                  {Math.round(deviceOrientation.alpha)}°
                </small>
                <div
                  className={`bg-${
                    isRecording ? "danger" : "light"
                  } rounded-pill mx-auto`}
                  style={{
                    width: "3px",
                    height: "20px",
                    transform: `rotate(${deviceOrientation.alpha}deg)`,
                    transformOrigin: "bottom center",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Recording indicator center */}
          {isRecording && (
            <div className="position-absolute top-50 start-50 translate-middle">
              <div className="text-center">
                <div
                  className={`bg-danger rounded-circle d-flex align-items-center justify-content-center mb-2 mx-auto ${
                    isPaused ? "" : "animate-pulse"
                  }`}
                  style={{ width: "40px", height: "40px" }}
                >
                  <span style={{ fontSize: "16px" }}>🎥</span>
                </div>
                <div className="bg-dark bg-opacity-75 px-2 py-1 rounded-pill">
                  <small className="text-white">
                    {isPaused ? "⏸️ Tạm dừng" : "Đang quay..."}
                  </small>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Panorama Preview */}
      {isRecording && currentPanoramaWidth > 0 && (
        <div className="p-2 bg-secondary">
          <div className="text-center mb-2">
            <small className="text-muted">📷 Panorama Live Preview</small>
          </div>
          <div className="bg-dark rounded p-2" style={{ overflowX: "auto" }}>
            <canvas
              ref={panoramaCanvasRef}
              className="border border-secondary rounded"
              style={{
                height: "80px",
                width: "auto",
                maxWidth: "none",
                imageRendering: "crisp-edges",
              }}
            />
          </div>
          <div className="text-center mt-1">
            <small className="text-muted">
              {recordingFrames} frames • {Math.round(currentPanoramaWidth)}px
              width
            </small>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-3">
        <div className="row g-2">
          {!isRecording ? (
            <>
              <div className="col-8">
                <button
                  onClick={startRecording}
                  className="btn btn-danger w-100 d-flex align-items-center justify-content-center fw-bold py-3"
                >
                  <Camera className="me-2" size={24} />
                  🔴 Bắt đầu Panorama
                </button>
              </div>
              <div className="col-4">
                <button
                  onClick={resetPanorama}
                  className="btn btn-outline-secondary w-100 py-3"
                  disabled={!finalPanorama}
                >
                  <RotateCcw size={20} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="col-4">
                <button
                  onClick={togglePause}
                  className={`btn w-100 py-3 ${
                    isPaused ? "btn-success" : "btn-warning"
                  }`}
                >
                  {isPaused ? <Play size={20} /> : <Pause size={20} />}
                </button>
              </div>
              <div className="col-8">
                <button
                  onClick={stopRecording}
                  className="btn btn-success w-100 d-flex align-items-center justify-content-center fw-bold py-3"
                >
                  <Square className="me-2" size={20} />✅ Hoàn thành (
                  {Math.round(progress)}%)
                </button>
              </div>
            </>
          )}
        </div>

        {/* Download Final Panorama */}
        {finalPanorama && (
          <div className="mt-3">
            <button
              onClick={downloadPanorama}
              className="btn btn-primary w-100 d-flex align-items-center justify-content-center fw-bold py-3"
            >
              <Download className="me-2" size={20} />
              📁 Tải xuống Panorama 360°
            </button>
          </div>
        )}
      </div>

      {/* Final Result Preview */}
      {finalPanorama && (
        <div className="p-3 border-top border-secondary">
          <h6 className="mb-2">🎉 Panorama 360° hoàn thành!</h6>
          <div className="bg-secondary rounded p-2">
            <img
              src={finalPanorama}
              alt="Panorama 360°"
              className="w-100 rounded"
              style={{ height: "120px", objectFit: "cover" }}
            />
          </div>
          <div className="text-center mt-2">
            <small className="text-muted">
              Kích thước: {currentPanoramaWidth}px × {panoramaHeight}px
            </small>
          </div>
        </div>
      )}

      {/* Hidden canvas for frame processing */}
      <canvas ref={canvasRef} className="d-none" />
    </div>
  );
};

export default PanoramaCameraApp;
