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
  const [completedAngles, setCompletedAngles] = useState(new Set());

  // Angle detection states
  const [deviceOrientation, setDeviceOrientation] = useState({
    alpha: 0,
    beta: 0,
    gamma: 0,
  });
  const [isCorrectAngle, setIsCorrectAngle] = useState(false);
  const [angleWarning, setAngleWarning] = useState("");
  const [orientationSupported, setOrientationSupported] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const backendUrl = "https://panorama-converter.onrender.com/";

  // 360° capture points - simplified for better angle detection
  const captureAngles = [
    {
      id: 0,
      name: "Bắc",
      angle: 0,
      x: 50,
      y: 20,
      instruction: "Hướng về phía Bắc",
      tolerance: 20,
    },
    {
      id: 1,
      name: "Đông Bắc",
      angle: 45,
      x: 70,
      y: 30,
      instruction: "Xoay sang Đông Bắc 45°",
      tolerance: 20,
    },
    {
      id: 2,
      name: "Đông",
      angle: 90,
      x: 80,
      y: 50,
      instruction: "Hướng về phía Đông",
      tolerance: 20,
    },
    {
      id: 3,
      name: "Đông Nam",
      angle: 135,
      x: 70,
      y: 70,
      instruction: "Xoay sang Đông Nam 45°",
      tolerance: 20,
    },
    {
      id: 4,
      name: "Nam",
      angle: 180,
      x: 50,
      y: 80,
      instruction: "Hướng về phía Nam",
      tolerance: 20,
    },
    {
      id: 5,
      name: "Tây Nam",
      angle: 225,
      x: 30,
      y: 70,
      instruction: "Xoay sang Tây Nam 45°",
      tolerance: 20,
    },
    {
      id: 6,
      name: "Tây",
      angle: 270,
      x: 20,
      y: 50,
      instruction: "Hướng về phía Tây",
      tolerance: 20,
    },
    {
      id: 7,
      name: "Tây Bắc",
      angle: 315,
      x: 30,
      y: 30,
      instruction: "Xoay sang Tây Bắc 45°",
      tolerance: 20,
    },

    // Tilted angles
    {
      id: 8,
      name: "Nghiêng Lên",
      angle: 0,
      x: 50,
      y: 10,
      instruction: "Nghiêng camera lên 30°",
      tolerance: 15,
      tilt: "up",
    },
    {
      id: 9,
      name: "Nghiêng Xuống",
      angle: 0,
      x: 50,
      y: 90,
      instruction: "Nghiêng camera xuống 30°",
      tolerance: 15,
      tilt: "down",
    },
  ];

  // Check backend status
  useEffect(() => {
    checkBackendStatus();

    // Check if device orientation is supported
    if (window.DeviceOrientationEvent) {
      setOrientationSupported(true);

      // Request permission for iOS 13+
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        // This is iOS 13+ - permission will be requested when camera starts
      } else {
        // Android or older iOS - start listening immediately
        startOrientationTracking();
      }
    }
  }, []);

  // Device orientation tracking
  const startOrientationTracking = () => {
    const handleOrientation = (event) => {
      setDeviceOrientation({
        alpha: event.alpha || 0, // Z-axis (compass direction)
        beta: event.beta || 0, // X-axis (tilt front/back)
        gamma: event.gamma || 0, // Y-axis (tilt left/right)
      });
    };

    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  };

  // Check angle correctness
  useEffect(() => {
    if (!isCameraActive || !orientationSupported) return;

    const currentAngle = captureAngles[currentStep];
    const { alpha, beta } = deviceOrientation;

    // Normalize compass direction (0-360)
    const normalizedAlpha = alpha < 0 ? alpha + 360 : alpha;
    const targetAngle = currentAngle.angle;

    // Calculate angle difference
    let angleDiff = Math.abs(normalizedAlpha - targetAngle);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;

    // Check tilt for special angles
    let tiltCorrect = true;
    let tiltWarning = "";

    if (currentAngle.tilt === "up") {
      if (beta > -15) {
        // Should tilt up (negative beta)
        tiltCorrect = false;
        tiltWarning = "Nghiêng camera lên nhiều hơn!";
      }
    } else if (currentAngle.tilt === "down") {
      if (beta < 15) {
        // Should tilt down (positive beta)
        tiltCorrect = false;
        tiltWarning = "Nghiêng camera xuống nhiều hơn!";
      }
    } else {
      // Normal horizontal shots - should be relatively level
      if (Math.abs(beta) > 20) {
        tiltCorrect = false;
        tiltWarning = "Giữ camera thẳng!";
      }
    }

    // Determine if angle is correct
    const angleCorrect = angleDiff <= currentAngle.tolerance;
    const overallCorrect = angleCorrect && tiltCorrect;

    setIsCorrectAngle(overallCorrect);

    // Set warning messages
    if (!overallCorrect) {
      if (!angleCorrect && !tiltCorrect) {
        setAngleWarning(
          `${getDirectionWarning(
            normalizedAlpha,
            targetAngle
          )} & ${tiltWarning}`
        );
      } else if (!angleCorrect) {
        setAngleWarning(getDirectionWarning(normalizedAlpha, targetAngle));
      } else if (!tiltCorrect) {
        setAngleWarning(tiltWarning);
      }
    } else {
      setAngleWarning("");
    }
  }, [deviceOrientation, currentStep, isCameraActive, orientationSupported]);

  const getDirectionWarning = (current, target) => {
    let diff = target - current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    if (Math.abs(diff) <= 20) return "";

    if (diff > 0) {
      return `Xoay phải ${Math.round(Math.abs(diff))}°`;
    } else {
      return `Xoay trái ${Math.round(Math.abs(diff))}°`;
    }
  };

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
    console.log("Starting 360° camera...");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Trình duyệt không hỗ trợ camera!");
        return;
      }

      // Request orientation permission on iOS 13+
      if (
        orientationSupported &&
        typeof DeviceOrientationEvent.requestPermission === "function"
      ) {
        try {
          const permission = await DeviceOrientationEvent.requestPermission();
          if (permission === "granted") {
            startOrientationTracking();
          } else {
            alert("Cần quyền truy cập orientation để hướng dẫn góc chụp!");
          }
        } catch (error) {
          console.error("Orientation permission error:", error);
        }
      }

      setShowCamera(true);
      setIsCameraActive(true);
      setCurrentStep(0);
      setCapturedPhotos([]);
      setCompletedAngles(new Set());
      setIsCorrectAngle(false);
      setAngleWarning("");

      let mediaStream;

      try {
        console.log("Trying back camera...");
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "environment",
          },
        });
      } catch (backCameraError) {
        console.log("Back camera failed, trying front camera...");
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user",
            },
          });
        } catch (frontCameraError) {
          console.log("Front camera failed, trying any camera...");
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
        }
      }

      if (videoRef.current && mediaStream) {
        console.log("Setting video stream...");
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);

        try {
          await videoRef.current.play();
          console.log("360° Camera started successfully!");
        } catch (playError) {
          console.log("Video play error:", playError);
        }
      } else {
        throw new Error("Không thể khởi tạo video element");
      }
    } catch (error) {
      console.error("Camera error:", error);
      setShowCamera(false);
      setIsCameraActive(false);

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

    // Check if angle is correct before capturing
    if (!isCorrectAngle && orientationSupported) {
      alert("⚠️ Chưa đúng góc! " + angleWarning);
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
        const file = new File(
          [blob],
          `panorama_${currentStep}_${Date.now()}.jpg`,
          { type: "image/jpeg" }
        );
        const imageUrl = URL.createObjectURL(blob);

        console.log(
          `360° Photo captured: ${currentStep + 1}/${captureAngles.length}`,
          captureAngles[currentStep].name
        );

        // Add to captured photos
        const newCapturedPhoto = {
          file,
          preview: imageUrl,
          angle: captureAngles[currentStep],
          step: currentStep,
        };

        setCapturedPhotos((prev) => {
          const updated = [...prev, newCapturedPhoto];
          console.log("Captured photos updated:", updated.length);
          return updated;
        });

        // Mark this angle as completed
        setCompletedAngles((prev) => new Set([...prev, currentStep]));

        // Add to main images and previews immediately
        const newImage = { file, element: null, name: file.name };

        setImages((prev) => {
          const updated = [...prev, newImage];
          console.log("Images updated:", updated.length);
          return updated;
        });

        setPreviews((prev) => {
          const updated = [...prev, imageUrl];
          console.log("Previews updated:", updated.length);
          return updated;
        });

        // Reset angle checking for next step
        setIsCorrectAngle(false);
        setAngleWarning("");

        // Move to next angle or finish
        if (currentStep < captureAngles.length - 1) {
          console.log(
            `Moving to angle ${currentStep + 2}/${captureAngles.length}`
          );
          setCurrentStep(currentStep + 1);
        } else {
          console.log(`Completed all ${captureAngles.length} angles!`);
          setTimeout(() => {
            stopCamera();
            alert(
              `🎉 Hoàn thành chụp 360°! Đã chụp ${captureAngles.length} góc.`
            );
          }, 500);
        }
      },
      "image/jpeg",
      0.9
    );
  };

  const skipCurrentAngle = () => {
    if (currentStep < captureAngles.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      stopCamera();
      alert(
        `Hoàn thành! Đã chụp ${completedAngles.size}/${captureAngles.length} góc.`
      );
    }
  };

  const retakePhoto = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;

      // Remove the previous photo
      setCapturedPhotos((prev) =>
        prev.filter((photo) => photo.step !== prevStep)
      );
      setCompletedAngles((prev) => {
        const newSet = new Set(prev);
        newSet.delete(prevStep);
        return newSet;
      });

      // Remove from main images
      setImages((prev) => prev.slice(0, -1));
      setPreviews((prev) => prev.slice(0, -1));

      setCurrentStep(prevStep);
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
      a.download = `panorama_360_${Date.now()}.jpg`;
      a.click();
    }
  };

  const clearAll = () => {
    setImages([]);
    setPreviews([]);
    setCapturedPhotos([]);
    setCompletedAngles(new Set());
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
            <h1 className="h2 mb-3">🌐 Panorama 360° Stitcher</h1>
            <div>
              <span
                className={`badge ${
                  backendStatus === "connected" ? "bg-success" : "bg-danger"
                } me-2`}
              >
                {backendStatus === "connected" ? "Connected" : "Offline"}
              </span>
              <span className="badge bg-secondary me-2">
                {images.length} images
              </span>
              <span className="badge bg-info">
                {completedAngles.size}/{captureAngles.length} angles
              </span>
            </div>
          </div>
        </div>

        {/* 360° Camera Modal */}
        {showCamera && (
          <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.9)", zIndex: 1060 }}
          >
            <div className="modal-dialog modal-fullscreen">
              <div className="modal-content bg-dark">
                <div className="modal-header border-secondary">
                  <h5 className="modal-title text-white">
                    📸 Chụp Panorama 360° - {captureAngles[currentStep].name}
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={stopCamera}
                  ></button>
                </div>
                <div
                  className="modal-body p-0 position-relative"
                  style={{ height: "calc(100vh - 120px)" }}
                >
                  {/* Camera View - No overlay */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-100 h-100"
                    style={{ objectFit: "cover" }}
                  />

                  {/* Simple Guidance Overlay */}
                  <div className="position-absolute top-0 start-0 w-100 p-3">
                    {/* Current instruction card */}
                    <div className="card bg-dark bg-opacity-75 text-white border-0 mb-3">
                      <div className="card-body py-2 px-3">
                        <div className="d-flex align-items-center justify-content-between">
                          <div>
                            <h6 className="mb-1 text-warning">
                              {captureAngles[currentStep].name}
                            </h6>
                            <small>
                              {captureAngles[currentStep].instruction}
                            </small>
                          </div>
                          <span className="badge bg-primary">
                            {currentStep + 1}/{captureAngles.length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Angle status */}
                    {orientationSupported && (
                      <div className="card bg-dark bg-opacity-75 text-white border-0">
                        <div className="card-body py-2 px-3">
                          {isCorrectAngle ? (
                            <div className="d-flex align-items-center text-success">
                              <i className="fas fa-check-circle me-2"></i>
                              <span>
                                <strong>✅ Đúng góc! Có thể chụp</strong>
                              </span>
                            </div>
                          ) : (
                            <div className="d-flex align-items-center text-warning">
                              <i className="fas fa-exclamation-triangle me-2"></i>
                              <span>
                                <strong>
                                  ⚠️ {angleWarning || "Điều chỉnh góc camera"}
                                </strong>
                              </span>
                            </div>
                          )}

                          {/* Compact debug info */}
                          <small className="text-muted d-block mt-1">
                            Hướng: {Math.round(deviceOrientation.alpha)}° |
                            Nghiêng: {Math.round(deviceOrientation.beta)}°
                          </small>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Progress indicators - bottom right */}
                  <div className="position-absolute bottom-0 end-0 p-3">
                    <div className="d-flex flex-column gap-1">
                      {captureAngles.map((_, index) => (
                        <div
                          key={index}
                          className={`rounded-circle ${
                            completedAngles.has(index)
                              ? "bg-success"
                              : index === currentStep
                              ? "bg-warning"
                              : "bg-secondary bg-opacity-50"
                          }`}
                          style={{ width: "12px", height: "12px" }}
                          title={captureAngles[index].name}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-footer border-secondary">
                  <div className="d-flex justify-content-between w-100">
                    <button
                      type="button"
                      className="btn btn-outline-light"
                      onClick={retakePhoto}
                      disabled={currentStep === 0}
                    >
                      <i className="fas fa-undo me-1"></i>
                      Chụp Lại
                    </button>

                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={skipCurrentAngle}
                      >
                        <i className="fas fa-forward me-1"></i>
                        Bỏ Qua
                      </button>
                      <button
                        type="button"
                        className={`btn btn-lg ${
                          isCorrectAngle ? "btn-success" : "btn-outline-success"
                        }`}
                        onClick={capturePhoto}
                        disabled={!isCorrectAngle && orientationSupported}
                      >
                        <i className="fas fa-camera me-1"></i>
                        {isCorrectAngle ? (
                          <>
                            ✅ Chụp ({currentStep + 1}/{captureAngles.length})
                          </>
                        ) : (
                          <>
                            ⚠️ Chờ đúng góc ({currentStep + 1}/
                            {captureAngles.length})
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={stopCamera}
                    >
                      <i className="fas fa-times me-1"></i>
                      Dừng
                    </button>
                  </div>
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
              className="btn btn-primary btn-lg me-2"
              onClick={startCamera}
              disabled={isCameraActive}
            >
              <i className="fas fa-globe me-2"></i>
              Chụp Panorama 360°
            </button>
          </div>
        </div>

        {/* 360° Progress Summary */}
        {capturedPhotos.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h6 className="mb-0">
                    <i className="fas fa-globe text-success me-1"></i>
                    Tiến Trình 360° ({completedAngles.size}/
                    {captureAngles.length} góc)
                  </h6>
                </div>
                <div className="card-body">
                  <div className="row g-2">
                    {capturedPhotos.map((photo, index) => (
                      <div key={index} className="col-6 col-md-3 col-lg-2">
                        <div className="position-relative">
                          <img
                            src={photo.preview}
                            className="w-100 rounded"
                            style={{ aspectRatio: "4/3", objectFit: "cover" }}
                            alt={photo.angle.name}
                          />
                          <div className="position-absolute top-0 start-0 m-1">
                            <span className="badge bg-success">
                              {photo.angle.name}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="progress">
                      <div
                        className="progress-bar bg-success"
                        style={{
                          width: `${
                            (completedAngles.size / captureAngles.length) * 100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <small className="text-muted">
                      Hoàn thành:{" "}
                      {Math.round(
                        (completedAngles.size / captureAngles.length) * 100
                      )}
                      %
                    </small>
                  </div>
                </div>
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
        {images.length > 0 && (
          <div className="row mb-4">
            <div className="col-12 text-center">
              <button
                className="btn btn-success btn-lg me-3"
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
                    Building 360° Panorama...
                  </>
                ) : (
                  <>
                    <i className="fas fa-magic me-1"></i>
                    Build 360° Panorama ({images.length} images)
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

        {/* Result */}
        {resultReady && resultImage && (
          <div className="row">
            <div className="col-12 text-center">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">
                    <i className="fas fa-check-circle text-success me-1"></i>
                    Panorama 360° Result
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
                    alt="Panorama 360° Result"
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

      {/* CSS for pulse animation */}
      <style>{`
        .pulse {
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.7;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default PanoramaStitcher;
