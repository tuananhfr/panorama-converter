import React, { useState, useRef, useEffect } from "react";

const PanoramaStitcher = () => {
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [resultImage, setResultImage] = useState(null);

  const fileInputRef = useRef(null);
  const backendUrl = "http://localhost:5000";

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
    setResultReady(false);
    setResultImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <link
        href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css"
        rel="stylesheet"
      />

      <div className="container py-5">
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12 text-center">
            <h1 className="h2 mb-3">Panorama Stitcher</h1>
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

        {/* Image Previews */}
        {previews.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
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
                <>Build Panorama ({images.length} images)</>
              )}
            </button>

            {images.length > 0 && (
              <button
                className="btn btn-outline-secondary btn-lg"
                onClick={clearAll}
                disabled={isProcessing}
              >
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
                  <h5 className="mb-0">Panorama Result</h5>
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
                <h6>Backend Setup Required</h6>
                <p className="mb-0">
                  Start Flask server: <code>python app.py</code>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PanoramaStitcher;
