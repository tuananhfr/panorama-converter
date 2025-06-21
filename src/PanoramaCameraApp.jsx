import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, RotateCcw, Download, Square, ArrowLeft } from "lucide-react";

const PanoramaCameraApp = ({ onBack }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [panoramaStrips, setPanoramaStrips] = useState([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [totalPanoramaWidth, setTotalPanoramaWidth] = useState(0);
  const [finalPanorama, setFinalPanorama] = useState(null);
  const [guidanceMessage, setGuidanceMessage] = useState("");
  const [isComplete, setIsComplete] = useState(false);

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
        streamRef.current = mediaStream;
      }
    } catch (error) {
      console.error("Lỗi camera:", error);
      alert("Không thể truy cập camera");
    }
  };

  // Dừng camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  };

  // Capture vertical strip từ video
  const captureVerticalStrip = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0) return null;

    // Set canvas size tạm để capture
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    // Extract vertical strip (độ rộng 10px)
    const stripWidth = 8;
    const stripCanvas = document.createElement("canvas");
    stripCanvas.width = stripWidth;
    stripCanvas.height = canvas.height;

    const stripCtx = stripCanvas.getContext("2d");

    // Copy vertical strip từ giữa video
    const centerX = Math.floor(canvas.width / 2) - Math.floor(stripWidth / 2);
    stripCtx.drawImage(
      canvas,
      centerX,
      0,
      stripWidth,
      canvas.height, // source
      0,
      0,
      stripWidth,
      canvas.height // destination
    );

    return stripCanvas.toDataURL("image/jpeg", 0.8);
  }, []);

  // Animation loop cho scanning
  const scanLoop = useCallback(() => {
    if (!isScanning) return;

    // Capture strip từ video
    const stripData = captureVerticalStrip();

    if (stripData) {
      setPanoramaStrips((prev) => [...prev, stripData]);
      setTotalPanoramaWidth((prev) => prev + 8); // Mỗi strip 8px

      // Update progress
      const newProgress = Math.min((totalPanoramaWidth / 2880) * 100, 100); // Target 360° ≈ 2880px
      setScanProgress(newProgress);

      // Update guidance
      if (newProgress < 25) {
        setGuidanceMessage("🟡 Tiếp tục xoay chậm rãi...");
      } else if (newProgress < 50) {
        setGuidanceMessage("🟠 Đã được 1/4, tiếp tục...");
      } else if (newProgress < 75) {
        setGuidanceMessage("🟠 Đã được 1/2, tiếp tục...");
      } else if (newProgress < 95) {
        setGuidanceMessage("🟢 Sắp xong rồi!");
      } else {
        setGuidanceMessage("🎉 Hoàn thành!");
        completePanorama();
        return;
      }
    }

    // Continue animation
    animationRef.current = requestAnimationFrame(scanLoop);
  }, [isScanning, totalPanoramaWidth, captureVerticalStrip]);

  // Bắt đầu quét panorama
  const startPanoramaScan = () => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) {
      alert("Vui lòng đợi camera khởi động xong");
      return;
    }

    setIsScanning(true);
    setIsComplete(false);
    setPanoramaStrips([]);
    setScanProgress(0);
    setTotalPanoramaWidth(0);
    setFinalPanorama(null);
    setGuidanceMessage("🔵 Bắt đầu xoay từ từ sang phải...");

    // Start animation loop
    animationRef.current = requestAnimationFrame(scanLoop);
  };

  // Dừng quét
  const stopPanoramaScan = () => {
    setIsScanning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    completePanorama();
  };

  // Hoàn thành panorama
  const completePanorama = () => {
    setIsScanning(false);
    setIsComplete(true);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Tạo panorama cuối cùng
    if (panoramaStrips.length > 0) {
      stitchFinalPanorama();
    }
  };

  // Ghép các strips thành panorama hoàn chỉnh
  const stitchFinalPanorama = async () => {
    if (panoramaStrips.length === 0) return;

    const finalCanvas = document.createElement("canvas");
    const ctx = finalCanvas.getContext("2d");

    // Set kích thước canvas cuối cùng
    finalCanvas.width = panoramaStrips.length * 8; // Mỗi strip 8px
    finalCanvas.height = 400; // Fixed height

    // Vẽ từng strip
    for (let i = 0; i < panoramaStrips.length; i++) {
      const img = new Image();
      img.src = panoramaStrips[i];

      await new Promise((resolve) => {
        img.onload = () => {
          ctx.drawImage(img, i * 8, 0, 8, finalCanvas.height);
          resolve();
        };
      });
    }

    const panoramaData = finalCanvas.toDataURL("image/jpeg", 0.9);
    setFinalPanorama(panoramaData);
  };

  // Reset
  const resetPanorama = () => {
    setIsScanning(false);
    setIsComplete(false);
    setPanoramaStrips([]);
    setScanProgress(0);
    setTotalPanoramaWidth(0);
    setFinalPanorama(null);
    setGuidanceMessage("");

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Download
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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Update scan loop when scanning state changes
  useEffect(() => {
    if (isScanning && !animationRef.current) {
      animationRef.current = requestAnimationFrame(scanLoop);
    }
  }, [isScanning, scanLoop]);

  return (
    <div className="min-vh-100 bg-black text-white position-relative">
      {/* Header */}
      <div className="position-absolute top-0 start-0 end-0 z-3 p-3">
        <div className="d-flex align-items-center justify-content-between">
          {onBack && (
            <button onClick={onBack} className="btn btn-outline-light btn-sm">
              <ArrowLeft size={16} />
            </button>
          )}
          <h1 className="h6 mb-0 text-center flex-grow-1">PANORAMA</h1>
          <div style={{ width: "60px" }}></div>
        </div>
      </div>

      {/* Camera Viewfinder - Full screen */}
      <div className="position-relative w-100 vh-100">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-100 h-100 object-fit-cover"
        />

        {/* Panorama Guide Overlay */}
        <div
          className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ pointerEvents: "none" }}
        >
          {/* Center Guide Line */}
          <div
            className="position-absolute bg-warning opacity-75"
            style={{
              width: "3px",
              height: "60%",
              left: "50%",
              top: "20%",
              transform: "translateX(-50%)",
              boxShadow: "0 0 10px rgba(255,193,7,0.8)",
            }}
          />

          {/* Scanning Area Indicator */}
          {isScanning && (
            <div className="position-absolute">
              <div
                className="bg-success opacity-50 animate-pulse"
                style={{
                  width: "20px",
                  height: "60%",
                  marginLeft: "-10px",
                  borderRadius: "10px",
                }}
              />
            </div>
          )}
        </div>

        {/* Progress Bar - Top */}
        {isScanning && (
          <div className="position-absolute top-0 start-0 end-0 mt-5 pt-3">
            <div className="mx-3">
              <div
                className="progress bg-dark bg-opacity-50"
                style={{ height: "6px" }}
              >
                <div
                  className="progress-bar bg-warning"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Guidance Message */}
        <div className="position-absolute bottom-0 start-0 end-0 mb-5 pb-5">
          <div className="text-center">
            <div className="bg-dark bg-opacity-75 d-inline-block px-4 py-2 rounded-pill">
              <div className="fw-bold mb-1">
                {scanProgress > 0 && `${Math.round(scanProgress)}%`}
              </div>
              <div className="small">
                {guidanceMessage ||
                  (isScanning
                    ? "🔵 Xoay chậm rãi sang phải"
                    : "📱 Sẵn sàng chụp panorama 360°")}
              </div>
            </div>
          </div>
        </div>

        {/* Live Panorama Strip Preview */}
        {isScanning && panoramaStrips.length > 0 && (
          <div className="position-absolute bottom-0 start-0 end-0 mb-2">
            <div className="px-3">
              <div className="bg-dark bg-opacity-75 rounded p-2">
                <div
                  className="d-flex overflow-hidden"
                  style={{ height: "40px" }}
                >
                  {panoramaStrips.slice(-50).map((strip, index) => (
                    <img
                      key={index}
                      src={strip}
                      alt=""
                      style={{
                        width: "8px",
                        height: "40px",
                        objectFit: "cover",
                        flex: "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="position-absolute bottom-0 start-0 end-0 p-4 bg-gradient-dark">
        <div className="d-flex align-items-center justify-content-center gap-4">
          {/* Reset Button */}
          <button
            onClick={resetPanorama}
            className="btn btn-outline-light rounded-circle"
            style={{ width: "50px", height: "50px" }}
            disabled={!finalPanorama && !isScanning}
          >
            <RotateCcw size={20} />
          </button>

          {/* Main Capture Button */}
          <button
            onClick={isScanning ? stopPanoramaScan : startPanoramaScan}
            disabled={!stream}
            className={`btn rounded-circle d-flex align-items-center justify-content-center ${
              isScanning ? "btn-danger" : "btn-light"
            }`}
            style={{ width: "80px", height: "80px" }}
          >
            {isScanning ? (
              <Square size={30} />
            ) : (
              <Camera size={30} className="text-dark" />
            )}
          </button>

          {/* Download Button */}
          <button
            onClick={downloadPanorama}
            className="btn btn-outline-light rounded-circle"
            style={{ width: "50px", height: "50px" }}
            disabled={!finalPanorama}
          >
            <Download size={20} />
          </button>
        </div>

        {/* Status Text */}
        <div className="text-center mt-3">
          <small className="text-muted">
            {!stream
              ? "Đang kết nối camera..."
              : isScanning
              ? `Đang quét... ${panoramaStrips.length} strips`
              : isComplete
              ? "✅ Hoàn thành panorama!"
              : "📷 Nhấn để bắt đầu panorama 360°"}
          </small>
        </div>
      </div>

      {/* Final Result Modal */}
      {finalPanorama && (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-90 d-flex align-items-center justify-content-center z-3">
          <div
            className="bg-white rounded p-3 m-3 text-dark w-100"
            style={{ maxWidth: "500px" }}
          >
            <h5 className="mb-3 text-center">🎉 Panorama 360° hoàn thành!</h5>
            <div className="mb-3">
              <img
                src={finalPanorama}
                alt="Panorama"
                className="w-100 rounded"
                style={{ height: "150px", objectFit: "cover" }}
              />
            </div>
            <div className="d-flex gap-2">
              <button
                onClick={downloadPanorama}
                className="btn btn-primary flex-fill"
              >
                📁 Tải xuống
              </button>
              <button
                onClick={() => setFinalPanorama(null)}
                className="btn btn-secondary"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="d-none" />

      <style>{`
        .bg-gradient-dark {
          background: linear-gradient(transparent, rgba(0,0,0,0.8));
        }
        .object-fit-cover {
          object-fit: cover;
        }
        .z-3 {
          z-index: 3;
        }
      `}</style>
    </div>
  );
};

export default PanoramaCameraApp;
