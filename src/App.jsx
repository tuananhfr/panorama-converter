import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Camera, Eye, Globe, Home, ArrowLeft } from "lucide-react";

import SkyBox from "./SkyBox.jsx";
import Pannellum from "./Pannellum.jsx";
import PanoramaCameraApp from "./PanoramaCameraApp.jsx";

// Sử dụng component PanoramaCameraApp đã có

// Trang chính với 3 buttons
const HomePage = () => {
  return (
    <div className="min-vh-100 bg-dark text-white">
      {/* Header */}
      <nav className="navbar navbar-dark bg-secondary">
        <div className="container">
          <span className="navbar-brand d-flex align-items-center">
            <Home size={24} className="me-2" />
            Panorama Suite
          </span>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            {/* App Title */}
            <div className="text-center mb-5">
              <h1 className="display-4 mb-3">🌍 Panorama Suite</h1>
              <p className="lead text-muted">
                Bộ công cụ hoàn chỉnh cho ảnh panorama 360°
              </p>
            </div>

            {/* Navigation Cards */}
            <div className="row g-4">
              {/* Camera App Card */}
              <div className="col-12">
                <Link to="/camera" className="text-decoration-none">
                  <div className="card bg-danger text-white h-100 shadow-lg hover-card">
                    <div className="card-body text-center p-4">
                      <Camera size={48} className="mb-3" />
                      <h4 className="card-title">📸 Panorama Camera</h4>
                      <p className="card-text">
                        Chụp ảnh panorama 360° với camera thiết bị
                      </p>
                      <div className="mt-3">
                        <span className="badge bg-light text-dark me-2">
                          Camera
                        </span>
                        <span className="badge bg-light text-dark me-2">
                          Gyroscope
                        </span>
                        <span className="badge bg-light text-dark">
                          Auto Stitch
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>

              {/* Pannellum Viewer Card */}
              <div className="col-12">
                <Link to="/pannellum" className="text-decoration-none">
                  <div className="card bg-success text-white h-100 shadow-lg hover-card">
                    <div className="card-body text-center p-4">
                      <Eye size={48} className="mb-3" />
                      <h4 className="card-title">👁️ Pannellum Viewer</h4>
                      <p className="card-text">
                        Xem ảnh panorama 360° với trải nghiệm tương tác
                      </p>
                      <div className="mt-3">
                        <span className="badge bg-light text-dark me-2">
                          360° View
                        </span>
                        <span className="badge bg-light text-dark me-2">
                          Touch Control
                        </span>
                        <span className="badge bg-light text-dark">
                          VR Ready
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>

              {/* SkyBox Card */}
              <div className="col-12">
                <Link to="/skybox" className="text-decoration-none">
                  <div className="card bg-primary text-white h-100 shadow-lg hover-card">
                    <div className="card-body text-center p-4">
                      <Globe size={48} className="mb-3" />
                      <h4 className="card-title">🌐 SkyBox 3D</h4>
                      <p className="card-text">
                        Hiển thị panorama trong môi trường 3D immersive
                      </p>
                      <div className="mt-3">
                        <span className="badge bg-light text-dark me-2">
                          3D
                        </span>
                        <span className="badge bg-light text-dark me-2">
                          WebGL
                        </span>
                        <span className="badge bg-light text-dark">
                          Immersive
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>

            {/* Footer Info */}
            <div className="text-center mt-5">
              <hr className="border-secondary" />
              <p className="text-muted">
                <small>
                  Hỗ trợ các định dạng: JPG, PNG | WebGL compatible | Mobile
                  friendly
                </small>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App với Router
const App = () => {
  return (
    <Router>
      <Routes>
        {/* Trang chính */}
        <Route path="/" element={<HomePage />} />

        {/* Route cho Camera App */}
        <Route path="/camera" element={<PanoramaCameraApp />} />

        {/* Route cho Pannellum */}
        <Route path="/pannellum" element={<Pannellum />} />

        {/* Route cho SkyBox */}
        <Route path="/skybox" element={<SkyBox />} />
      </Routes>

      {/* Custom CSS để tạo hiệu ứng hover */}
      <style jsx>{`
        .hover-card {
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .hover-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
        }

        .card {
          border: none;
          transition: all 0.3s ease;
        }

        .navbar-brand {
          font-weight: bold;
          font-size: 1.25rem;
        }

        .display-4 {
          font-weight: 300;
        }

        .lead {
          font-size: 1.1rem;
        }
      `}</style>
    </Router>
  );
};

export default App;
