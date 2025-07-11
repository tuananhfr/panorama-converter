import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const PanoramaViewer = () => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const meshRef = useRef(null);

  // Interaction state
  const interactionRef = useRef({
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initialize Three.js scene
    const init = () => {
      // Camera với FOV nhỏ hơn cho panorama hẹp
      cameraRef.current = new THREE.PerspectiveCamera(
        60, // Giảm FOV để phù hợp với góc nhìn hẹp hơn
        window.innerWidth / window.innerHeight,
        1,
        1100
      );

      // Scene
      sceneRef.current = new THREE.Scene();

      // Sử dụng CylinderGeometry thay vì SphereGeometry cho panorama hẹp
      const geometry = new THREE.CylinderGeometry(500, 500, 500, 32, 1, true);
      // Xoay geometry để phù hợp với texture panorama
      geometry.rotateY(Math.PI);

      // Load texture từ file demo.jpg
      const texture = new THREE.TextureLoader().load(
        "./panorama_360_optimized.jpg"
      );
      texture.colorSpace = THREE.SRGBColorSpace;

      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide, // Hiển thị bên trong cylinder
      });
      meshRef.current = new THREE.Mesh(geometry, material);
      sceneRef.current.add(meshRef.current);

      // Renderer
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(rendererRef.current.domElement);

      // Start animation loop
      rendererRef.current.setAnimationLoop(animate);
    };

    // Animation function
    const animate = () => {
      const interaction = interactionRef.current;

      if (!interaction.isUserInteracting) {
        interaction.lon += 0.1;
      }

      interaction.lat = Math.max(-85, Math.min(85, interaction.lat));
      interaction.phi = THREE.MathUtils.degToRad(90 - interaction.lat);
      interaction.theta = THREE.MathUtils.degToRad(interaction.lon);

      const x = 500 * Math.sin(interaction.phi) * Math.cos(interaction.theta);
      const y = 500 * Math.cos(interaction.phi);
      const z = 500 * Math.sin(interaction.phi) * Math.sin(interaction.theta);

      if (cameraRef.current) {
        cameraRef.current.lookAt(x, y, z);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    // Event handlers
    const onPointerDown = (event) => {
      if (event.isPrimary === false) return;

      const interaction = interactionRef.current;
      interaction.isUserInteracting = true;
      interaction.onPointerDownMouseX = event.clientX;
      interaction.onPointerDownMouseY = event.clientY;
      interaction.onPointerDownLon = interaction.lon;
      interaction.onPointerDownLat = interaction.lat;

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    };

    const onPointerMove = (event) => {
      if (event.isPrimary === false) return;

      const interaction = interactionRef.current;
      interaction.lon =
        (interaction.onPointerDownMouseX - event.clientX) * 0.1 +
        interaction.onPointerDownLon;
      interaction.lat =
        (event.clientY - interaction.onPointerDownMouseY) * 0.1 +
        interaction.onPointerDownLat;
    };

    const onPointerUp = (event) => {
      if (event.isPrimary === false) return;

      interactionRef.current.isUserInteracting = false;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };

    const onDocumentMouseWheel = (event) => {
      if (!cameraRef.current) return;

      const fov = cameraRef.current.fov + event.deltaY * 0.05;
      // Điều chỉnh giới hạn zoom cho panorama hẹp
      cameraRef.current.fov = THREE.MathUtils.clamp(fov, 30, 90);
      cameraRef.current.updateProjectionMatrix();
    };

    const onWindowResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;

      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };

    // Initialize scene
    init();

    // Add event listeners
    container.style.touchAction = "none";
    container.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("wheel", onDocumentMouseWheel);
    window.addEventListener("resize", onWindowResize);

    // Cleanup function
    return () => {
      // Remove event listeners
      container.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("wheel", onDocumentMouseWheel);
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);

      // Dispose Three.js objects
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(null);
        if (container && rendererRef.current.domElement) {
          container.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }

      if (meshRef.current) {
        if (meshRef.current.geometry) meshRef.current.geometry.dispose();
        if (meshRef.current.material) {
          if (meshRef.current.material.map)
            meshRef.current.material.map.dispose();
          meshRef.current.material.dispose();
        }
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 text-white text-sm bg-black bg-opacity-50 px-3 py-2 rounded">
        <p>
          <span className="text-blue-300">Three.js React</span> -
          Equirectangular Panorama Demo
        </p>
        <p className="text-xs mt-1 opacity-75">
          Drag to look around • Scroll to zoom • Limited panorama view (90-180°)
        </p>
      </div>
    </div>
  );
};

export default PanoramaViewer;
