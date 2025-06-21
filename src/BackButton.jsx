import { BrowserRouter as Router, useNavigate } from "react-router-dom";
import { Camera, Eye, Globe, Home, ArrowLeft } from "lucide-react";
const BackButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/")}
      className="btn btn-outline-light mt-3 d-flex align-items-center mx-auto"
    >
      <ArrowLeft size={16} className="me-2" />
      Về trang chính
    </button>
  );
};

export default BackButton;
