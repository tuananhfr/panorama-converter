import { useState, useRef, useEffect } from "react";
import * as THREE from "three";

const DualPanoramaConverter = () => {
  // State for both panoramas
  const [panorama1, setPanorama1] = useState(null);
  const [panorama2, setPanorama2] = useState(null);
  const [isProcessing1, setIsProcessing1] = useState(false);
  const [isProcessing2, setIsProcessing2] = useState(false);
  const [syncViewers, setSyncViewers] = useState(true);
  const [isFullscreen1, setIsFullscreen1] = useState(false);
  const [isFullscreen2, setIsFullscreen2] = useState(false);

  // Refs for both canvases
  const canvas1Ref = useRef(null);
  const canvas2Ref = useRef(null);
  const container1Ref = useRef(null);
  const container2Ref = useRef(null);
  const scene1Ref = useRef(null);
  const scene2Ref = useRef(null);
  const renderer1Ref = useRef(null);
  const renderer2Ref = useRef(null);
  const camera1Ref = useRef(null);
  const camera2Ref = useRef(null);
  const animation1Ref = useRef(null);
  const animation2Ref = useRef(null);
  const sphere1Ref = useRef(null);
  const sphere2Ref = useRef(null);

  // Mouse interaction state for each viewer
  const interaction1Ref = useRef({
    isUserInteracting: false,
    onPointerDownMouseX: 0,
    onPointerDownMouseY: 0,
    lon: 0,
    onPointerDownLon: 0,
    lat: 0,
    onPointerDownLat: 0,
    phi: 0,
    theta: 0,
  });

  const interaction2Ref = useRef({
    isUserInteracting: false,
    onPointerDownMouseX: 0,
    onPointerDownMouseY: 0,
    lon: 0,
    onPointerDownLon: 0,
    lat: 0,
    onPointerDownLat: 0,
    phi: 0,
    theta: 0,
  });

  // Initialize 3D scenes for both viewers
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeViewer(1);
      initializeViewer(2);
    }, 100);

    return () => {
      clearTimeout(timer);
      cleanup(1);
      cleanup(2);
    };
  }, []);

  // Add resize listener
  useEffect(() => {
    const handleResize = () => {
      resizeCanvas(1);
      resizeCanvas(2);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen1(
        !!document.fullscreenElement &&
          document.fullscreenElement.id === "fullscreen-container-1"
      );
      setIsFullscreen2(
        !!document.fullscreenElement &&
          document.fullscreenElement.id === "fullscreen-container-2"
      );
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const initializeViewer = (viewerNum) => {
    const canvasRef = viewerNum === 1 ? canvas1Ref : canvas2Ref;
    const containerRef = viewerNum === 1 ? container1Ref : container2Ref;

    if (!canvasRef.current || !containerRef.current) {
      console.log(`Canvas or container not ready for viewer ${viewerNum}`);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 1, 1100);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvasRef.current,
    });

    // Calculate responsive size
    const containerWidth = containerRef.current.offsetWidth;
    const canvasSize = Math.max(300, containerWidth - 40);

    renderer.setSize(canvasSize, canvasSize);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1.0);

    // Update camera aspect ratio
    camera.aspect = 1;
    camera.updateProjectionMatrix();

    // Store refs
    if (viewerNum === 1) {
      scene1Ref.current = scene;
      renderer1Ref.current = renderer;
      camera1Ref.current = camera;
    } else {
      scene2Ref.current = scene;
      renderer2Ref.current = renderer;
      camera2Ref.current = camera;
    }

    // Add mouse interaction
    setupMouseInteraction(viewerNum);

    // Animation loop (without auto-rotation)
    const animate = () => {
      const animationRef = viewerNum === 1 ? animation1Ref : animation2Ref;
      const interactionRef =
        viewerNum === 1 ? interaction1Ref : interaction2Ref;
      const otherInteractionRef =
        viewerNum === 1 ? interaction2Ref : interaction1Ref;
      const otherCameraRef = viewerNum === 1 ? camera2Ref : camera1Ref;

      animationRef.current = requestAnimationFrame(animate);

      const interaction = interactionRef.current;

      // Update camera based on interaction (no auto-rotation)
      interaction.lat = Math.max(-85, Math.min(85, interaction.lat));
      interaction.phi = THREE.MathUtils.degToRad(90 - interaction.lat);
      interaction.theta = THREE.MathUtils.degToRad(interaction.lon);

      const x = 500 * Math.sin(interaction.phi) * Math.cos(interaction.theta);
      const y = 500 * Math.cos(interaction.phi);
      const z = 500 * Math.sin(interaction.phi) * Math.sin(interaction.theta);

      camera.lookAt(x, y, z);

      // Sync with other viewer if enabled (chỉ sync khi user đang tương tác)
      if (
        syncViewers &&
        otherCameraRef.current &&
        interaction.isUserInteracting
      ) {
        const otherInteraction = otherInteractionRef.current;
        otherInteraction.lon = interaction.lon;
        otherInteraction.lat = interaction.lat;
        otherInteraction.phi = interaction.phi;
        otherInteraction.theta = interaction.theta;

        otherCameraRef.current.lookAt(x, y, z);
      }

      renderer.render(scene, camera);
    };
    animate();

    console.log(`Viewer ${viewerNum} initialized successfully`);
  };

  const setupMouseInteraction = (viewerNum) => {
    const canvasRef = viewerNum === 1 ? canvas1Ref : canvas2Ref;
    const interactionRef = viewerNum === 1 ? interaction1Ref : interaction2Ref;

    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const interaction = interactionRef.current;

    // Pointer down
    const onPointerDown = (event) => {
      if (event.isPrimary === false) return;

      interaction.isUserInteracting = true;
      interaction.onPointerDownMouseX = event.clientX;
      interaction.onPointerDownMouseY = event.clientY;
      interaction.onPointerDownLon = interaction.lon;
      interaction.onPointerDownLat = interaction.lat;

      // Tạo handlers riêng cho mỗi viewer
      const onPointerMove = (event) => {
        if (event.isPrimary === false) return;

        interaction.lon =
          (interaction.onPointerDownMouseX - event.clientX) * 0.1 +
          interaction.onPointerDownLon;
        interaction.lat =
          (event.clientY - interaction.onPointerDownMouseY) * 0.1 +
          interaction.onPointerDownLat;
      };

      const onPointerUp = (event) => {
        if (event.isPrimary === false) return;

        interaction.isUserInteracting = false;
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    };

    // Mouse wheel for zoom (sync both viewers)
    const onWheel = (event) => {
      event.preventDefault();

      // Sync zoom for both cameras
      if (camera1Ref.current) {
        const fov1 = camera1Ref.current.fov + event.deltaY * 0.05;
        camera1Ref.current.fov = THREE.MathUtils.clamp(fov1, 10, 75);
        camera1Ref.current.updateProjectionMatrix();
      }

      if (camera2Ref.current) {
        const fov2 = camera2Ref.current.fov + event.deltaY * 0.05;
        camera2Ref.current.fov = THREE.MathUtils.clamp(fov2, 10, 75);
        camera2Ref.current.updateProjectionMatrix();
      }
    };

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("wheel", onWheel);

    // Store cleanup functions
    const cleanup = () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("wheel", onWheel);
    };

    // Store cleanup for later use
    if (viewerNum === 1) {
      canvas._cleanup1 = cleanup;
    } else {
      canvas._cleanup2 = cleanup;
    }
  };

  // Resize canvas to match container
  const resizeCanvas = (viewerNum) => {
    const rendererRef = viewerNum === 1 ? renderer1Ref : renderer2Ref;
    const cameraRef = viewerNum === 1 ? camera1Ref : camera2Ref;
    const containerRef = viewerNum === 1 ? container1Ref : container2Ref;
    const isFullscreen = viewerNum === 1 ? isFullscreen1 : isFullscreen2;

    if (rendererRef.current && cameraRef.current && containerRef.current) {
      let canvasSize;

      if (isFullscreen) {
        // In fullscreen, use the smaller dimension to maintain square aspect
        canvasSize = Math.min(window.innerWidth, window.innerHeight) - 100;
      } else {
        const containerWidth = containerRef.current.offsetWidth;
        canvasSize = Math.max(300, containerWidth - 40);
      }

      rendererRef.current.setSize(canvasSize, canvasSize);
      cameraRef.current.aspect = 1;
      cameraRef.current.updateProjectionMatrix();
    }
  };

  const cleanup = (viewerNum) => {
    const animationRef = viewerNum === 1 ? animation1Ref : animation2Ref;
    const rendererRef = viewerNum === 1 ? renderer1Ref : renderer2Ref;
    const canvasRef = viewerNum === 1 ? canvas1Ref : canvas2Ref;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    if (canvasRef.current) {
      const cleanup = canvasRef.current[`_cleanup${viewerNum}`];
      if (cleanup) cleanup();
    }
  };

  // Handle file upload for specific viewer
  const handleFileUpload = async (event, viewerNum) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    const panoramaState = viewerNum === 1 ? panorama1 : panorama2;
    const setPanorama = viewerNum === 1 ? setPanorama1 : setPanorama2;
    const setIsProcessing =
      viewerNum === 1 ? setIsProcessing1 : setIsProcessing2;

    if (panoramaState) {
      URL.revokeObjectURL(panoramaState);
    }

    const url = URL.createObjectURL(file);
    setPanorama(url);
    setIsProcessing(true);
    setTimeout(() => resizeCanvas(viewerNum), 50);

    try {
      await createPanoramaSphere(url, viewerNum);
    } catch (error) {
      console.error(`Error creating panorama for viewer ${viewerNum}:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Detect panorama type based on aspect ratio and other factors
  const detectPanoramaType = (image) => {
    const aspectRatio = image.width / image.height;

    console.log("Image info:", {
      width: image.width,
      height: image.height,
      aspectRatio: aspectRatio.toFixed(2),
    });

    // Equirectangular: 2:1 ratio (360x180)
    if (aspectRatio >= 1.9 && aspectRatio <= 2.1) {
      return { type: "equirectangular", hFov: 360, vFov: 180 };
    }

    // Panorama điện thoại - estimate cả hFov và vFov
    if (aspectRatio > 2.1 && aspectRatio <= 12) {
      let estimatedHFov, estimatedVFov;

      if (aspectRatio <= 3) {
        estimatedHFov = 180;
        estimatedVFov = 90; // Giảm vFov
      } else if (aspectRatio <= 4.5) {
        estimatedHFov = 240;
        estimatedVFov = 100; // Giảm vFov
      } else if (aspectRatio <= 6) {
        estimatedHFov = 270;
        estimatedVFov = 110; // Giảm vFov
      } else {
        estimatedHFov = 300;
        estimatedVFov = 120; // Giảm vFov
      }

      console.log(
        `Detected partial panorama: ${estimatedHFov}° x ${estimatedVFov}°`
      );
      return { type: "partial", hFov: estimatedHFov, vFov: estimatedVFov };
    }

    // Standard partial panorama
    if (aspectRatio >= 1.2 && aspectRatio <= 2.1) {
      const estimatedHFov = Math.min(180, aspectRatio * 90);
      const estimatedVFov = Math.min(120, 180 / aspectRatio); // Tính vFov dựa trên ratio
      return { type: "partial", hFov: estimatedHFov, vFov: estimatedVFov };
    }

    // Fallback
    return { type: "partial", hFov: 180, vFov: 120 };
  };

  // Create panorama sphere with different geometries based on type
  const createPanoramaSphere = async (imageUrl, viewerNum) => {
    return new Promise((resolve, reject) => {
      const sceneRef = viewerNum === 1 ? scene1Ref : scene2Ref;
      const sphereRef = viewerNum === 1 ? sphere1Ref : sphere2Ref;

      if (!sceneRef.current) {
        reject(new Error("Scene not initialized"));
        return;
      }

      // Remove existing sphere
      if (sphereRef.current) {
        sceneRef.current.remove(sphereRef.current);
        sphereRef.current = null;
      }

      // Load texture first to get image dimensions
      const loader = new THREE.TextureLoader();
      loader.load(
        imageUrl,
        (texture) => {
          console.log(
            "Original texture size:",
            texture.image.width,
            "x",
            texture.image.height
          );

          texture.colorSpace = THREE.SRGBColorSpace;

          // Thêm các settings này để tránh vỡ hình
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.wrapS = THREE.ClampToEdgeWrap;
          texture.wrapT = THREE.ClampToEdgeWrap;
          texture.needsUpdate = true;

          // Create temporary image to get dimensions
          const img = texture.image;
          const panoramaInfo = detectPanoramaType(img);

          console.log(
            `Detected panorama type: ${panoramaInfo.type}, hFov: ${panoramaInfo.hFov}°, vFov: ${panoramaInfo.vFov}°`
          );

          let geometry;
          let material;

          switch (panoramaInfo.type) {
            case "cylindrical":
              geometry = createCylindricalGeometry(panoramaInfo);
              material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide,
              });
              break;
            case "partial":
              geometry = createPartialSphereGeometry(panoramaInfo);
              material = new THREE.MeshBasicMaterial({ map: texture });
              break;
            default: // equirectangular
              geometry = new THREE.SphereGeometry(500, 60, 40);
              geometry.scale(-1, 1, 1);
              material = new THREE.MeshBasicMaterial({ map: texture });
          }
          const sphere = new THREE.Mesh(geometry, material);
          sphere.name = `panorama-sphere-${viewerNum}`;

          sceneRef.current.add(sphere);
          sphereRef.current = sphere;

          resolve(sphere);
          setTimeout(() => resizeCanvas(viewerNum), 50);
        },
        undefined,
        reject
      );
    });
  };

  // Create cylindrical geometry for 360° horizontal
  const createCylindricalGeometry = (panoramaInfo) => {
    const radius = 500;
    const height = 500;

    const geometry = new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      32,
      1,
      true
    );

    // Xoay geometry để phù hợp với texture panorama
    geometry.rotateY(Math.PI);

    return geometry;
  };

  // Create partial sphere geometry for limited horizontal FOV
  const createPartialSphereGeometry = (panoramaInfo) => {
    const radius = 500;
    const hFovRad = THREE.MathUtils.degToRad(panoramaInfo.hFov);
    const vFovRad = THREE.MathUtils.degToRad(panoramaInfo.vFov);

    const phiStart = -hFovRad / 2;
    const phiLength = hFovRad;

    // Fix vFov calculation - đặt ở giữa sphere
    const thetaStart = (Math.PI - vFovRad) / 2; // Bắt đầu từ giữa
    const thetaLength = vFovRad;

    console.log(
      `Creating partial sphere: ${panoramaInfo.hFov}° x ${panoramaInfo.vFov}°`
    );
    console.log(`Theta: start=${thetaStart}, length=${thetaLength}`);

    const geometry = new THREE.SphereGeometry(
      radius,
      Math.max(32, Math.floor((64 * panoramaInfo.hFov) / 360)),
      Math.max(16, Math.floor((32 * panoramaInfo.vFov) / 180)),
      phiStart,
      phiLength,
      thetaStart,
      thetaLength
    );

    geometry.scale(-1, 1, 1);
    return geometry;
  };

  // Global zoom functions
  const zoomIn = () => {
    if (camera1Ref.current) {
      const newFov = THREE.MathUtils.clamp(camera1Ref.current.fov - 5, 10, 75);
      camera1Ref.current.fov = newFov;
      camera1Ref.current.updateProjectionMatrix();
    }
    if (camera2Ref.current) {
      const newFov = THREE.MathUtils.clamp(camera2Ref.current.fov - 5, 10, 75);
      camera2Ref.current.fov = newFov;
      camera2Ref.current.updateProjectionMatrix();
    }
  };

  const zoomOut = () => {
    if (camera1Ref.current) {
      const newFov = THREE.MathUtils.clamp(camera1Ref.current.fov + 5, 10, 75);
      camera1Ref.current.fov = newFov;
      camera1Ref.current.updateProjectionMatrix();
    }
    if (camera2Ref.current) {
      const newFov = THREE.MathUtils.clamp(camera2Ref.current.fov + 5, 10, 75);
      camera2Ref.current.fov = newFov;
      camera2Ref.current.updateProjectionMatrix();
    }
  };

  // Fullscreen functions
  const toggleFullscreen = async (viewerNum) => {
    const containerId = `fullscreen-container-${viewerNum}`;
    const container = document.getElementById(containerId);

    if (!container) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
        // Resize canvas after entering fullscreen
        setTimeout(() => resizeCanvas(viewerNum), 100);
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="row">
        {/* Viewer 1 */}
        <div className="col-lg-6 mb-4">
          <div className="card h-100">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">📤 Panorama 1</h5>
            </div>
            <div className="card-body">
              {/* File Upload */}
              <div className="mb-3">
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 1)}
                  disabled={isProcessing1}
                />
                {isProcessing1 && (
                  <div className="text-primary mt-2">
                    <small>Processing...</small>
                  </div>
                )}
              </div>

              {/* 3D Preview */}
              <div
                className="mb-3 text-center"
                ref={container1Ref}
                id="fullscreen-container-1"
                style={{
                  position: "relative", // Thêm position relative
                  backgroundColor: isFullscreen1 ? "#000" : "transparent",
                  padding: isFullscreen1 ? "50px" : "0",
                }}
              >
                <canvas
                  ref={canvas1Ref}
                  style={{
                    border: "2px solid #dee2e6",
                    borderRadius: "12px",
                    backgroundColor: "#000",
                    width: "100%",
                    maxWidth: "100%",
                    height: "auto",
                    display: "block",
                  }}
                />
                {!sphere1Ref.current && (
                  <div
                    className="position-absolute top-50 start-50 translate-middle text-white text-center"
                    style={{
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  >
                    <div className="display-1 mb-2 opacity-50">🌐</div>
                    <p className="fs-6">Upload panorama image</p>
                    <small className="opacity-75">
                      Click and drag to look around • Scroll to zoom
                    </small>
                  </div>
                )}

                {/* Viewer Controls Overlay */}
                {sphere1Ref.current && (
                  <div
                    className="position-absolute top-0 end-0 p-2"
                    style={{ zIndex: 10 }}
                  >
                    <div className="d-flex flex-column gap-1">
                      <button
                        className="btn btn-light btn-sm shadow-sm border-0 panorama-control-btn"
                        onClick={zoomIn}
                        title="Zoom In"
                      >
                        <i className="bi bi-zoom-in"></i>
                      </button>
                      <button
                        className="btn btn-light btn-sm shadow-sm border-0 panorama-control-btn"
                        onClick={zoomOut}
                        title="Zoom Out"
                      >
                        <i className="bi bi-zoom-out"></i>
                      </button>
                      <button
                        className="btn btn-light btn-sm shadow-sm border-0 panorama-control-btn"
                        onClick={() => toggleFullscreen(1)}
                        title={
                          isFullscreen1 ? "Exit Fullscreen" : "Enter Fullscreen"
                        }
                      >
                        {isFullscreen1 ? (
                          <i className="bi bi-fullscreen-exit"></i>
                        ) : (
                          <i className="bi bi-fullscreen"></i>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Viewer 2 */}
        <div className="col-lg-6 mb-4">
          <div className="card h-100">
            <div className="card-header bg-success text-white">
              <h5 className="card-title mb-0">📤 Panorama 2</h5>
            </div>
            <div className="card-body">
              {/* File Upload */}
              <div className="mb-3">
                <input
                  type="file"
                  className="form-control"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 2)}
                  disabled={isProcessing2}
                />
                {isProcessing2 && (
                  <div className="text-success mt-2">
                    <small>Processing...</small>
                  </div>
                )}
              </div>

              {/* 3D Preview */}
              <div
                className="mb-3 text-center"
                ref={container2Ref}
                id="fullscreen-container-2"
                style={{
                  position: "relative", // Thêm position relative
                  backgroundColor: isFullscreen2 ? "#000" : "transparent",
                  padding: isFullscreen2 ? "50px" : "0",
                }}
              >
                <canvas
                  ref={canvas2Ref}
                  style={{
                    border: "2px solid #dee2e6",
                    borderRadius: "12px",
                    backgroundColor: "#000",
                    width: "100%",
                    maxWidth: "100%",
                    height: "auto",
                    display: "block",
                  }}
                />
                {!sphere2Ref.current && (
                  <div
                    className="position-absolute top-50 start-50 translate-middle text-white text-center"
                    style={{
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  >
                    <div className="display-1 mb-2 opacity-50">🌐</div>
                    <p className="fs-6">Upload panorama image</p>
                    <small className="opacity-75">
                      Click and drag to look around • Scroll to zoom
                    </small>
                  </div>
                )}

                {/* Viewer Controls Overlay */}
                {sphere2Ref.current && (
                  <div
                    className="position-absolute top-0 end-0 p-2"
                    style={{ zIndex: 10 }}
                  >
                    <div className="d-flex flex-column gap-1">
                      <button
                        className="btn btn-light btn-sm shadow-sm border-0 panorama-control-btn"
                        onClick={zoomIn}
                        title="Zoom In"
                      >
                        <i className="bi bi-zoom-in"></i>
                      </button>
                      <button
                        className="btn btn-light btn-sm shadow-sm border-0 panorama-control-btn"
                        onClick={zoomOut}
                        title="Zoom Out"
                      >
                        <i className="bi bi-zoom-out"></i>
                      </button>
                      <button
                        className="btn btn-light btn-sm shadow-sm border-0 panorama-control-btn"
                        onClick={() => toggleFullscreen(2)}
                        title={
                          isFullscreen2 ? "Exit Fullscreen" : "Enter Fullscreen"
                        }
                      >
                        {isFullscreen2 ? (
                          <i className="bi bi-fullscreen-exit"></i>
                        ) : (
                          <i className="bi bi-fullscreen"></i>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DualPanoramaConverter;
