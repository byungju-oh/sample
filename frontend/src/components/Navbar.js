import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          🕳️ Seoul Sinkhole Predictor
        </Link>
        
        <div className="nav-menu">
          <Link to="/dashboard" className="nav-link">대시보드</Link>
          <Link to="/map" className="nav-link">위험지도</Link>
          <Link to="/route" className="nav-link">안전경로</Link>
          <Link to="/login" className="nav-link">로그인</Link>
          <Link to="/register" className="nav-link">회원가입</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;