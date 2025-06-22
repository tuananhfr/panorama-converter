import { useState, useRef, useEffect } from "react";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const DualPanoramaConverter = () => {
  // State for both panoramas
  const [panorama1, setPanorama1] = useState(null);
  const [panorama2, setPanorama2] = useState(null);
  const [isProcessing1, setIsProcessing1] = useState(false);
  const [isProcessing2, setIsProcessing2] = useState(false);
  const [processingStep1, setProcessingStep1] = useState("");
  const [processingStep2, setProcessingStep2] = useState("");
  const [glbData1, setGlbData1] = useState(null);
  const [glbData2, setGlbData2] = useState(null);
  const [skyboxFaces1, setSkyboxFaces1] = useState({});
  const [skyboxFaces2, setSkyboxFaces2] = useState({});
  const [syncViewers, setSyncViewers] = useState(true);

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
  const controls1Ref = useRef(null);
  const controls2Ref = useRef(null);
  const animation1Ref = useRef(null);
  const animation2Ref = useRef(null);
  const skybox1Ref = useRef(null);
  const skybox2Ref = useRef(null);

  // Initialize 3D scenes for both viewers
  useEffect(() => {
    // Delay initialization to ensure DOM is ready
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

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const initializeViewer = (viewerNum) => {
    const canvasRef = viewerNum === 1 ? canvas1Ref : canvas2Ref;
    const containerRef = viewerNum === 1 ? container1Ref : container2Ref;

    if (!canvasRef.current || !containerRef.current) {
      console.log(`Canvas or container not ready for viewer ${viewerNum}`);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 25);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvasRef.current,
    });

    // Calculate responsive size
    const containerWidth = containerRef.current.offsetWidth;
    const canvasSize = Math.max(300, containerWidth); // Minimum 300px

    renderer.setSize(canvasSize, canvasSize);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x222222, 1.0);

    // Update camera aspect ratio
    camera.aspect = 1;
    camera.updateProjectionMatrix();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 10;
    controls.maxDistance = 40;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = false;

    // Sync controls if enabled
    if (syncViewers) {
      controls.addEventListener("change", () => {
        if (viewerNum === 1 && controls2Ref.current) {
          syncCamera(camera, camera2Ref.current);
        } else if (viewerNum === 2 && controls1Ref.current) {
          syncCamera(camera, camera1Ref.current);
        }
      });
    }

    // Store refs
    if (viewerNum === 1) {
      scene1Ref.current = scene;
      renderer1Ref.current = renderer;
      camera1Ref.current = camera;
      controls1Ref.current = controls;
    } else {
      scene2Ref.current = scene;
      renderer2Ref.current = renderer;
      camera2Ref.current = camera;
      controls2Ref.current = controls;
    }

    // Animation loop
    const animate = () => {
      const animationRef = viewerNum === 1 ? animation1Ref : animation2Ref;
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    console.log(`Viewer ${viewerNum} initialized successfully`);
  };

  // Resize canvas to match container
  const resizeCanvas = (viewerNum) => {
    const rendererRef = viewerNum === 1 ? renderer1Ref : renderer2Ref;
    const cameraRef = viewerNum === 1 ? camera1Ref : camera2Ref;
    const containerRef = viewerNum === 1 ? container1Ref : container2Ref;

    if (rendererRef.current && cameraRef.current && containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth;
      const canvasSize = Math.max(300, containerWidth - 40);

      rendererRef.current.setSize(canvasSize, canvasSize);
      cameraRef.current.aspect = 1;
      cameraRef.current.updateProjectionMatrix();
    }
  };

  const syncCamera = (sourceCamera, targetCamera) => {
    if (!targetCamera) return;
    targetCamera.position.copy(sourceCamera.position);
    targetCamera.rotation.copy(sourceCamera.rotation);
    targetCamera.zoom = sourceCamera.zoom;
    targetCamera.updateProjectionMatrix();
  };

  const cleanup = (viewerNum) => {
    const animationRef = viewerNum === 1 ? animation1Ref : animation2Ref;
    const rendererRef = viewerNum === 1 ? renderer1Ref : renderer2Ref;
    const controlsRef = viewerNum === 1 ? controls1Ref : controls2Ref;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    if (controlsRef.current) {
      controlsRef.current.dispose();
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
    const setProcessingStep =
      viewerNum === 1 ? setProcessingStep1 : setProcessingStep2;
    const setGlbData = viewerNum === 1 ? setGlbData1 : setGlbData2;

    if (panoramaState) {
      URL.revokeObjectURL(panoramaState);
    }

    const url = URL.createObjectURL(file);
    setPanorama(url);
    setGlbData(null);

    setIsProcessing(true);
    setProcessingStep("Converting panorama...");

    try {
      await convertToCubeFaces(url, viewerNum);
      setProcessingStep("Conversion complete!");
      setTimeout(() => setProcessingStep(""), 2000);
    } catch (error) {
      console.error(`Conversion error for viewer ${viewerNum}:`, error);
      setProcessingStep("Conversion failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert panorama to cube faces for specific viewer
  const convertToCubeFaces = async (imageUrl, viewerNum) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const faceSize = 512;
          const faces = {};
          const faceNames = ["right", "left", "top", "bottom", "front", "back"];

          for (let i = 0; i < 6; i++) {
            const faceCanvas = document.createElement("canvas");
            faceCanvas.width = faceSize;
            faceCanvas.height = faceSize;
            const faceCtx = faceCanvas.getContext("2d");
            const faceImageData = faceCtx.createImageData(faceSize, faceSize);

            for (let y = 0; y < faceSize; y++) {
              for (let x = 0; x < faceSize; x++) {
                const direction = faceCoordsTo3D(x, y, faceSize, i);
                const [u, v] = directionToEquirectangular(direction);

                const srcX = Math.floor(u * (canvas.width - 1));
                const srcY = Math.floor(v * (canvas.height - 1));

                const srcIndex = (srcY * canvas.width + srcX) * 4;
                const dstIndex = (y * faceSize + x) * 4;

                faceImageData.data[dstIndex] = imageData.data[srcIndex];
                faceImageData.data[dstIndex + 1] = imageData.data[srcIndex + 1];
                faceImageData.data[dstIndex + 2] = imageData.data[srcIndex + 2];
                faceImageData.data[dstIndex + 3] = 255;
              }
            }

            faceCtx.putImageData(faceImageData, 0, 0);

            faceCanvas.toBlob((blob) => {
              faces[faceNames[i]] = URL.createObjectURL(blob);

              if (Object.keys(faces).length === 6) {
                if (viewerNum === 1) {
                  setSkyboxFaces1(faces);
                } else {
                  setSkyboxFaces2(faces);
                }
                resolve(faces);
              }
            }, "image/png");
          }
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = reject;
      img.src = imageUrl;
    });
  };

  // Projection math functions
  const faceCoordsTo3D = (x, y, faceSize, face) => {
    const a = (2.0 * x) / faceSize - 1.0;
    const b = (2.0 * y) / faceSize - 1.0;

    let direction;

    switch (face) {
      case 0:
        direction = [1.0, -b, -a];
        break;
      case 1:
        direction = [-1.0, -b, a];
        break;
      case 2:
        direction = [a, 1.0, b];
        break;
      case 3:
        direction = [a, -1.0, -b];
        break;
      case 4:
        direction = [a, -b, 1.0];
        break;
      case 5:
        direction = [-a, -b, -1.0];
        break;
    }

    const length = Math.sqrt(
      direction[0] * direction[0] +
        direction[1] * direction[1] +
        direction[2] * direction[2]
    );
    return [
      direction[0] / length,
      direction[1] / length,
      direction[2] / length,
    ];
  };

  const directionToEquirectangular = (direction) => {
    const [x, y, z] = direction;
    const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
    const v = 0.5 - Math.asin(y) / Math.PI;
    return [u, v];
  };

  // Generate skybox for specific viewer
  const generateSkybox = async (viewerNum) => {
    const skyboxFaces = viewerNum === 1 ? skyboxFaces1 : skyboxFaces2;
    const setIsProcessing =
      viewerNum === 1 ? setIsProcessing1 : setIsProcessing2;
    const setProcessingStep =
      viewerNum === 1 ? setProcessingStep1 : setProcessingStep2;
    const setGlbData = viewerNum === 1 ? setGlbData1 : setGlbData2;

    if (Object.keys(skyboxFaces).length !== 6) {
      alert(`Please upload a panorama image for viewer ${viewerNum} first`);
      return;
    }

    setIsProcessing(true);
    setProcessingStep("Creating skybox...");

    try {
      const skybox = await createSkybox(skyboxFaces);

      const skyboxRef = viewerNum === 1 ? skybox1Ref : skybox2Ref;
      const sceneRef = viewerNum === 1 ? scene1Ref : scene2Ref;

      if (skyboxRef.current && sceneRef.current) {
        sceneRef.current.remove(skyboxRef.current);
      }

      if (sceneRef.current) {
        sceneRef.current.add(skybox);
        skyboxRef.current = skybox;
      }

      // Export to GLB
      setProcessingStep("Exporting GLB...");
      const exportScene = new THREE.Scene();
      const exportSkybox = skybox.clone();
      exportSkybox.scale.setScalar(200);
      exportScene.add(exportSkybox);

      const exportCamera = new THREE.PerspectiveCamera(90, 16 / 9, 0.1, 500);
      exportCamera.position.set(0, 0, 0);
      exportCamera.name = "PanoramaCamera";
      exportScene.add(exportCamera);

      const exporter = new GLTFExporter();
      exporter.parse(
        exportScene,
        (gltf) => {
          setGlbData(gltf);
          setProcessingStep("Ready!");
          setTimeout(() => setProcessingStep(""), 2000);
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
          maxTextureSize: 1024,
        }
      );
    } catch (error) {
      console.error("Skybox creation error:", error);
      setProcessingStep("Creation failed");
      setIsProcessing(false);
    }
  };

  // Create skybox mesh
  const createSkybox = (skyboxFaces) => {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      const materials = [];
      let loadedCount = 0;
      const faceOrder = ["right", "left", "top", "bottom", "front", "back"];

      const onTextureLoad = (texture, index) => {
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        materials[index] = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
        });

        loadedCount++;
        if (loadedCount === 6) {
          const geometry = new THREE.BoxGeometry(100, 100, 100);
          const skybox = new THREE.Mesh(geometry, materials);
          skybox.name = "skybox";
          resolve(skybox);
        }
      };

      faceOrder.forEach((face, index) => {
        const imageUrl = skyboxFaces[face];
        if (imageUrl) {
          loader.load(imageUrl, (texture) => onTextureLoad(texture, index));
        }
      });
    });
  };

  // Download functions
  const downloadGLB = (viewerNum) => {
    const glbData = viewerNum === 1 ? glbData1 : glbData2;
    if (!glbData) return;

    const blob = new Blob([glbData], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `panorama-skybox-${viewerNum}-${Date.now()}.glb`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadHTMLViewer = async (viewerNum) => {
    const panorama = viewerNum === 1 ? panorama1 : panorama2;
    if (!panorama) return;

    try {
      const base64Image = await imageToBase64(panorama);
      const htmlContent = generateHTMLContent(base64Image, viewerNum);

      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `panorama-viewer-${viewerNum}-${Date.now()}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("HTML export error:", error);
    }
  };

  // Utility functions
  const imageToBase64 = (imageUrl) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.crossOrigin = "anonymous";
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result.split(",")[1];
              resolve(base64);
            };
            reader.readAsDataURL(blob);
          },
          "image/jpeg",
          0.9
        );
      };

      img.onerror = reject;
      img.src = imageUrl;
    });
  };

  const generateHTMLContent = (base64Image, viewerNum) => {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>360° Panorama Viewer ${viewerNum}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #000; overflow: hidden; }
        #container { width: 100vw; height: 100vh; position: relative; }
        #controls {
            position: absolute; top: 20px; left: 20px; z-index: 100;
            color: white; background: rgba(0,0,0,0.7); padding: 15px;
            border-radius: 8px; font-size: 14px;
        }
        #fullscreen-btn {
            position: absolute; top: 20px; right: 20px; z-index: 100;
            background: rgba(0,0,0,0.7); color: white; border: none;
            padding: 10px 15px; border-radius: 5px; cursor: pointer;
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="controls">
            <strong>🌍 360° Panorama ${viewerNum}</strong><br>
            Drag: Look around<br>
            Scroll: Zoom<br>
            F: Fullscreen
        </div>
        <button id="fullscreen-btn" onclick="toggleFullscreen()">⛶</button>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    
    <script>
        let scene, camera, renderer, sphere;
        let mouseDown = false, mouseX = 0, mouseY = 0;
        let rotationX = 0, rotationY = 0;

        function init() {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 0, 0);
            
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.getElementById('container').appendChild(renderer.domElement);
            
            const loader = new THREE.TextureLoader();
            loader.load('data:image/jpeg;base64,${base64Image}', function(texture) {
                const geometry = new THREE.SphereGeometry(500, 60, 40);
                geometry.scale(-1, 1, 1);
                const material = new THREE.MeshBasicMaterial({ map: texture });
                sphere = new THREE.Mesh(geometry, material);
                scene.add(sphere);
                animate();
            });
            
            setupEvents();
        }
        
        function setupEvents() {
            const canvas = renderer.domElement;
            canvas.addEventListener('mousedown', (e) => { mouseDown = true; mouseX = e.clientX; mouseY = e.clientY; });
            canvas.addEventListener('mousemove', (e) => {
                if (!mouseDown) return;
                rotationY += (e.clientX - mouseX) * 0.005;
                rotationX += (e.clientY - mouseY) * 0.005;
                rotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, rotationX));
                mouseX = e.clientX; mouseY = e.clientY;
            });
            canvas.addEventListener('mouseup', () => mouseDown = false);
            canvas.addEventListener('wheel', (e) => {
                camera.fov = Math.max(10, Math.min(120, camera.fov + e.deltaY * 0.05));
                camera.updateProjectionMatrix();
            });
            window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            });
            document.addEventListener('keydown', (e) => {
                if (e.code === 'KeyF') toggleFullscreen();
            });
        }
        
        function animate() {
            requestAnimationFrame(animate);
            camera.rotation.x = rotationX;
            camera.rotation.y = rotationY;
            renderer.render(scene, camera);
        }
        
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
        
        window.addEventListener('load', init);
    </script>
</body>
</html>`;
  };

  // Reset functions
  const resetViewer = (viewerNum) => {
    const panorama = viewerNum === 1 ? panorama1 : panorama2;
    const setPanorama = viewerNum === 1 ? setPanorama1 : setPanorama2;
    const setSkyboxFaces = viewerNum === 1 ? setSkyboxFaces1 : setSkyboxFaces2;
    const setGlbData = viewerNum === 1 ? setGlbData1 : setGlbData2;
    const setProcessingStep =
      viewerNum === 1 ? setProcessingStep1 : setProcessingStep2;
    const skyboxRef = viewerNum === 1 ? skybox1Ref : skybox2Ref;
    const sceneRef = viewerNum === 1 ? scene1Ref : scene2Ref;

    if (panorama) URL.revokeObjectURL(panorama);

    setPanorama(null);
    setSkyboxFaces({});
    setGlbData(null);
    setProcessingStep("");

    if (skyboxRef.current && sceneRef.current) {
      sceneRef.current.remove(skyboxRef.current);
      skyboxRef.current = null;
    }
  };

  const resetAll = () => {
    resetViewer(1);
    resetViewer(2);
  };

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-12">
          <h1 className="text-center mb-4">
            <span className="display-6">🌍</span>
            Dual 360° Panorama Converter
          </h1>
          <p className="text-center text-muted mb-4">
            Upload two panoramas to compare and convert them side by side
          </p>
        </div>
      </div>

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
              </div>

              {/* 3D Preview */}
              <div
                className="mb-3 text-center position-relative"
                ref={container1Ref}
              >
                <canvas
                  ref={canvas1Ref}
                  style={{
                    border: "2px solid #dee2e6",
                    borderRadius: "12px",
                    backgroundColor: "#222",
                    width: "100%",
                    maxWidth: "100%",
                    height: "auto",
                    display: "block",
                  }}
                />
                {!skybox1Ref.current && (
                  <div
                    className="position-absolute top-50 start-50 translate-middle text-white text-center"
                    style={{
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  >
                    <div className="display-1 mb-2 opacity-50">📤</div>
                    <p className="fs-6">Upload panorama 1</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="d-grid gap-2">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => generateSkybox(1)}
                  disabled={
                    isProcessing1 || Object.keys(skyboxFaces1).length !== 6
                  }
                >
                  🎯 Generate Skybox 1
                </button>

                {glbData1 && (
                  <button
                    className="btn btn-success"
                    onClick={() => downloadGLB(1)}
                  >
                    💾 Download GLB
                  </button>
                )}

                {panorama1 && (
                  <button
                    className="btn btn-info"
                    onClick={() => downloadHTMLViewer(1)}
                  >
                    🌐 Download HTML
                  </button>
                )}

                <button
                  className="btn btn-outline-secondary"
                  onClick={() => resetViewer(1)}
                >
                  🔄 Reset
                </button>
              </div>

              {/* Success Messages */}
              {glbData1 && (
                <div className="alert alert-success mt-3">
                  ✅ GLB 1 ready for download!
                </div>
              )}
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
              </div>

              {/* 3D Preview */}
              <div
                className="mb-3 text-center position-relative"
                ref={container2Ref}
              >
                <canvas
                  ref={canvas2Ref}
                  style={{
                    border: "2px solid #dee2e6",
                    borderRadius: "12px",
                    backgroundColor: "#222",
                    width: "100%",
                    maxWidth: "100%",
                    height: "auto",
                    display: "block",
                  }}
                />
                {!skybox2Ref.current && (
                  <div
                    className="position-absolute top-50 start-50 translate-middle text-white text-center"
                    style={{
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  >
                    <div className="display-1 mb-2 opacity-50">📤</div>
                    <p className="fs-6">Upload panorama 2</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="d-grid gap-2">
                <button
                  className="btn btn-success btn-lg"
                  onClick={() => generateSkybox(2)}
                  disabled={
                    isProcessing2 || Object.keys(skyboxFaces2).length !== 6
                  }
                >
                  🎯 Generate Skybox 2
                </button>

                {glbData2 && (
                  <button
                    className="btn btn-success"
                    onClick={() => downloadGLB(2)}
                  >
                    💾 Download GLB
                  </button>
                )}

                {panorama2 && (
                  <button
                    className="btn btn-info"
                    onClick={() => downloadHTMLViewer(2)}
                  >
                    🌐 Download HTML
                  </button>
                )}

                <button
                  className="btn btn-outline-secondary"
                  onClick={() => resetViewer(2)}
                >
                  🔄 Reset
                </button>
              </div>

              {/* Success Messages */}
              {glbData2 && (
                <div className="alert alert-success mt-3">
                  ✅ GLB 2 ready for download!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Global Controls */}
      <div className="row mt-4">
        <div className="col-12 text-center">
          <button className="btn btn-outline-danger btn-lg" onClick={resetAll}>
            🗑️ Reset All
          </button>
        </div>
      </div>
    </div>
  );
};

export default DualPanoramaConverter;
