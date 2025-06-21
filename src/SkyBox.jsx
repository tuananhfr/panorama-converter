import { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import BackButton from "./BackButton.jsx"; // Import the BackButton component
const SkyBox = () => {
  const [glbData, setGlbData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");

  // 6 images for skybox faces
  const [skyboxImages, setSkyboxImages] = useState({
    front: null,
    back: null,
    left: null,
    right: null,
    top: null,
    bottom: null,
  });

  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animationRef = useRef(null);
  const skyboxRef = useRef(null);

  // Initialize 3D scene
  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene Setup
    const scene = new THREE.Scene();

    // Camera Setup
    const fov = 35;
    const aspect = 800 / 600;
    const near = 0.1;
    const far = 1000;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 0, 25);

    // Renderer Setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvasRef.current,
    });
    renderer.setSize(800, 600);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 1.0);

    // Disable depth testing for skybox to prevent z-fighting
    renderer.sortObjects = false;

    // Adding orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 10;
    controls.maxDistance = 40;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  const handleImageSelect = (face, event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      // Clean up previous URL
      if (skyboxImages[face]) {
        URL.revokeObjectURL(skyboxImages[face]);
      }

      const url = URL.createObjectURL(file);
      setSkyboxImages((prev) => ({
        ...prev,
        [face]: url,
      }));
      setGlbData(null);
    }
  };

  const handleMultipleFilesSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Clean up previous URLs
    Object.values(skyboxImages).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });

    // Reset skybox images
    const newSkyboxImages = {
      front: null,
      back: null,
      left: null,
      right: null,
      top: null,
      bottom: null,
    };

    // Auto-detect faces based on filename
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const fileName = file.name.toLowerCase();
      let detectedFace = null;

      // Check filename for face keywords
      if (fileName.includes("front")) detectedFace = "front";
      else if (fileName.includes("back")) detectedFace = "back";
      else if (fileName.includes("left")) detectedFace = "left";
      else if (fileName.includes("right")) detectedFace = "right";
      else if (
        fileName.includes("top") ||
        fileName.includes("up") ||
        fileName.includes("ceiling")
      )
        detectedFace = "top";
      else if (
        fileName.includes("bottom") ||
        fileName.includes("down") ||
        fileName.includes("floor")
      )
        detectedFace = "bottom";

      if (detectedFace) {
        const url = URL.createObjectURL(file);
        newSkyboxImages[detectedFace] = url;
      }
    });

    setSkyboxImages(newSkyboxImages);
    setGlbData(null);

    // Show notification of detected files
    const detectedCount = Object.values(newSkyboxImages).filter(
      (url) => url !== null
    ).length;
    if (detectedCount > 0) {
      setProcessingStep(`Detected ${detectedCount} face(s) from filenames`);
      setTimeout(() => setProcessingStep(""), 3000);
    }
  };

  const createSkybox = () => {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      const textureArray = [];
      let loadedCount = 0;
      const totalTextures = 6;

      // Order for BoxGeometry faces: [+X, -X, +Y, -Y, +Z, -Z]
      // Which corresponds to: [right, left, top, bottom, front, back]
      const faceOrder = ["right", "left", "top", "bottom", "front", "back"];

      const onTextureLoad = (texture, index) => {
        // Fix texture wrapping to eliminate seams
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
        });
        textureArray[index] = material;

        loadedCount++;
        if (loadedCount === totalTextures) {
          // Create cube geometry with no gaps
          const cubeGeometry = new THREE.BoxGeometry(100, 100, 100);
          const skybox = new THREE.Mesh(cubeGeometry, textureArray);
          skybox.name = "skybox";
          resolve(skybox);
        }
      };

      const onTextureError = (error) => {
        console.error("Texture loading error:", error);
        reject(error);
      };

      // Load textures in the correct order
      faceOrder.forEach((face, index) => {
        const imageUrl = skyboxImages[face];
        if (imageUrl) {
          loader.load(
            imageUrl,
            (texture) => onTextureLoad(texture, index),
            undefined,
            onTextureError
          );
        } else {
          // Create a placeholder texture if image is missing
          const canvas = document.createElement("canvas");
          canvas.width = 512;
          canvas.height = 512;
          const ctx = canvas.getContext("2d");

          // Create a simple colored texture based on face
          const colors = {
            front: "#ff6b6b",
            back: "#4ecdc4",
            left: "#45b7d1",
            right: "#f9ca24",
            top: "#6c5ce7",
            bottom: "#a55eea",
          };

          ctx.fillStyle = colors[face] || "#888888";
          ctx.fillRect(0, 0, 512, 512);

          // Add text label
          ctx.fillStyle = "#ffffff";
          ctx.font = "36px Arial";
          ctx.textAlign = "center";
          ctx.fillText(face.toUpperCase(), 256, 256);

          const texture = new THREE.CanvasTexture(canvas);
          // Apply same wrapping settings to placeholder
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          onTextureLoad(texture, index);
        }
      });
    });
  };

  const generateSkybox = async () => {
    // Check if at least one image is uploaded
    const hasImages = Object.values(skyboxImages).some((img) => img !== null);
    if (!hasImages) {
      alert("Please upload at least one image for the skybox");
      return;
    }

    setIsProcessing(true);
    setProcessingStep("Loading textures...");

    try {
      // Create skybox
      setProcessingStep("Creating skybox...");
      const skybox = await createSkybox();

      // Remove previous skybox
      if (skyboxRef.current && sceneRef.current) {
        sceneRef.current.remove(skyboxRef.current);
      }

      // Add new skybox to scene
      if (sceneRef.current) {
        sceneRef.current.add(skybox);
        skyboxRef.current = skybox;
      }

      // Create scene for export
      setProcessingStep("Preparing for export...");
      const exportScene = new THREE.Scene();
      exportScene.add(skybox.clone());

      // Export to GLB
      setProcessingStep("Exporting to GLB...");
      const exporter = new GLTFExporter();
      exporter.parse(
        exportScene,
        (gltf) => {
          setGlbData(gltf);
          setProcessingStep("");
          setIsProcessing(false);
        },
        (error) => {
          console.error("Export error:", error);
          setProcessingStep("Export failed");
          setIsProcessing(false);
        },
        {
          binary: true,
          embedImages: true,
          maxTextureSize: 2048,
        }
      );
    } catch (error) {
      console.error("Error creating skybox:", error);
      setProcessingStep("Process failed");
      setIsProcessing(false);
    }
  };

  const downloadGLB = () => {
    if (!glbData) return;

    const blob = new Blob([glbData], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `skybox-cube-${Date.now()}.glb`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    // Clean up image URLs
    Object.values(skyboxImages).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });

    setSkyboxImages({
      front: null,
      back: null,
      left: null,
      right: null,
      top: null,
      bottom: null,
    });

    setGlbData(null);
    setIsProcessing(false);
    setProcessingStep("");

    // Remove skybox from scene
    if (skyboxRef.current && sceneRef.current) {
      sceneRef.current.remove(skyboxRef.current);
      skyboxRef.current = null;
    }
  };

  const faceLabels = {
    front: { name: "Front (+Z)", icon: "📱", color: "#ff6b6b" },
    back: { name: "Back (-Z)", icon: "🔙", color: "#4ecdc4" },
    left: { name: "Left (-X)", icon: "⬅️", color: "#45b7d1" },
    right: { name: "Right (+X)", icon: "➡️", color: "#f9ca24" },
    top: { name: "Top (+Y)", icon: "⬆️", color: "#6c5ce7" },
    bottom: { name: "Bottom (-Y)", icon: "⬇️", color: "#a55eea" },
  };

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <h1 className="text-center mb-4">
            <i className="bi bi-box me-2"></i>
            6-Face Cube Skybox Generator
          </h1>
          <p className="text-center text-muted mb-4">
            Upload 6 images to create a perfect cube skybox for 3D environments
          </p>
        </div>
      </div>

      <div className="row">
        {/* Input Section */}
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">
                <i className="bi bi-upload me-2"></i>
                Upload Cube Faces
              </h5>
            </div>
            <div
              className="card-body"
              style={{ maxHeight: "80vh", overflowY: "auto" }}
            >
              <div className="alert alert-info mb-3">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Two ways to upload:</strong> Use batch upload for
                auto-detection, or individual uploads for precise control.
              </div>

              {/* Batch Upload Section */}
              <div className="card mb-3">
                <div className="card-header bg-success text-white">
                  <h6 className="mb-0">
                    <i className="bi bi-files me-2"></i>
                    Batch Upload (Auto-detect)
                  </h6>
                </div>
                <div className="card-body">
                  <input
                    type="file"
                    className="form-control mb-2"
                    accept="image/*"
                    multiple
                    onChange={handleMultipleFilesSelect}
                  />
                  <small className="text-muted">
                    <strong>Filename keywords:</strong> front, back, left,
                    right, top/up/ceiling, bottom/down/floor
                    <br />
                    <strong>Examples:</strong> room_front.jpg, kitchen_back.png,
                    office_top.jpg
                  </small>
                  {processingStep && !isProcessing && (
                    <div className="alert alert-success mt-2 py-2">
                      <i className="bi bi-check-circle me-2"></i>
                      {processingStep}
                    </div>
                  )}
                </div>
              </div>

              {/* Individual uploads */}
              <div className="card mb-3">
                <div className="card-header bg-primary text-white">
                  <h6 className="mb-0">
                    <i className="bi bi-upload me-2"></i>
                    Individual Face Upload
                  </h6>
                </div>
                <div className="card-body">
                  {/* 6 Face uploads */}
                  <div className="row g-2 mb-3">
                    {Object.entries(faceLabels).map(([face, info]) => (
                      <div key={face} className="col-6">
                        <div className="card h-100">
                          <div
                            className="card-header text-white p-2"
                            style={{ backgroundColor: info.color }}
                          >
                            <h6 className="card-title fs-6 mb-0">
                              {info.icon} {info.name}
                            </h6>
                          </div>
                          <div className="card-body p-2">
                            <input
                              type="file"
                              className="form-control form-control-sm mb-2"
                              accept="image/*"
                              onChange={(e) => handleImageSelect(face, e)}
                            />
                            {skyboxImages[face] ? (
                              <img
                                src={skyboxImages[face]}
                                alt={info.name}
                                className="img-fluid rounded border"
                                style={{
                                  maxHeight: "80px",
                                  width: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <div
                                className="d-flex align-items-center justify-content-center text-white rounded"
                                style={{
                                  height: "80px",
                                  backgroundColor: info.color,
                                  fontSize: "12px",
                                }}
                              >
                                {info.icon}
                                <br />
                                {face.toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="d-grid gap-2">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={generateSkybox}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      ></span>
                      {processingStep || "Processing..."}
                    </>
                  ) : (
                    <>
                      <i className="bi bi-box-seam me-2"></i>
                      Generate Skybox
                    </>
                  )}
                </button>

                {glbData && (
                  <button
                    className="btn btn-success btn-lg"
                    onClick={downloadGLB}
                  >
                    <i className="bi bi-download me-2"></i>
                    Download GLB
                  </button>
                )}

                <button
                  className="btn btn-outline-secondary"
                  onClick={resetAll}
                  disabled={isProcessing}
                >
                  <i className="bi bi-arrow-clockwise me-2"></i>
                  Reset All
                </button>
              </div>

              {glbData && (
                <div className="alert alert-success mt-3">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  <strong>Success!</strong> Cube skybox GLB ready for download.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3D Viewer Section */}
        <div className="col-md-8">
          <div className="card h-100">
            <div className="card-header bg-info text-white">
              <h5 className="card-title mb-0">
                <i className="bi bi-eye-fill me-2"></i>
                Skybox Preview
              </h5>
            </div>
            <div className="card-body d-flex justify-content-center align-items-center position-relative">
              <div className="position-relative">
                <canvas
                  ref={canvasRef}
                  style={{
                    border: "2px solid #dee2e6",
                    borderRadius: "8px",
                    maxWidth: "100%",
                    height: "auto",
                    backgroundColor: "#000000",
                  }}
                />
                {!glbData && (
                  <div
                    className="position-absolute top-50 start-50 translate-middle text-white text-center"
                    style={{ pointerEvents: "none", zIndex: 1 }}
                  >
                    <i className="bi bi-box display-1 mb-3 opacity-50"></i>
                    <p className="fs-5">
                      Upload images and generate skybox
                      <br />
                      to see cube preview
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="card-footer text-muted bg-light">
              <small>
                <i className="bi bi-mouse me-1"></i>
                <strong>Controls:</strong> Drag to rotate • Scroll to zoom •
                Explore all 6 faces
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header bg-warning">
              <h6 className="card-title mb-0">
                <i className="bi bi-lightbulb-fill me-2"></i>
                Cube Skybox Guide:
              </h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6 className="text-primary">📁 Auto-Detection Keywords:</h6>
                  <ul>
                    <li>
                      <strong>front</strong> → Front face (+Z)
                    </li>
                    <li>
                      <strong>back</strong> → Back face (-Z)
                    </li>
                    <li>
                      <strong>left</strong> → Left face (-X)
                    </li>
                    <li>
                      <strong>right</strong> → Right face (+X)
                    </li>
                    <li>
                      <strong>top/up/ceiling</strong> → Top face (+Y)
                    </li>
                    <li>
                      <strong>bottom/down/floor</strong> → Bottom face (-Y)
                    </li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6 className="text-success">💡 Filename Examples:</h6>
                  <ul>
                    <li>room_front.jpg ✅</li>
                    <li>kitchen_back.png ✅</li>
                    <li>office_left.webp ✅</li>
                    <li>house_top.jpg ✅</li>
                    <li>floor_bottom.png ✅</li>
                    <li>skybox_right.jpg ✅</li>
                  </ul>
                </div>
              </div>
              <div className="alert alert-info mt-3">
                <i className="bi bi-gear me-2"></i>
                <strong>Technical Note:</strong> This follows the standard
                Three.js BoxGeometry face ordering. The generated GLB can be
                used in Unity, Unreal Engine, Blender, and other 3D
                applications.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkyBox;
