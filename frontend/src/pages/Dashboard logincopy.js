import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import axios from 'axios';
import '../styles/Dashboard.css';

const Dashboard = () => {
 /* const { user } = useAuth();  로그인만 보게하려면*/
  const [currentLocation, setCurrentLocation] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationInput, setLocationInput] = useState({
    latitude: '',
    longitude: ''
  });

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setCurrentLocation(location);
          checkRiskAtLocation(location);
        },
        (error) => {
          toast.error('위치 정보를 가져올 수 없습니다: ' + error.message);
        }
      );
    } else {
      toast.error('이 브라우저는 위치 서비스를 지원하지 않습니다.');
    }
  };

  const checkRiskAtLocation = async (location) => {
    setLoading(true);
    try {
      const response = await axios.post('/predict-risk', location);
      setRiskData(response.data);
    } catch (error) {
      toast.error('위험도 예측 실패: ' + (error.response?.data?.detail || '서버 오류'));
    } finally {
      setLoading(false);
    }
  };

  const handleManualLocationCheck = async (e) => {
    e.preventDefault();
    if (!locationInput.latitude || !locationInput.longitude) {
      toast.error('위도와 경도를 모두 입력해주세요.');
      return;
    }

    const location = {
      latitude: parseFloat(locationInput.latitude),
      longitude: parseFloat(locationInput.longitude)
    };

    await checkRiskAtLocation(location);
  };

  const getRiskColor = (riskScore) => {
    if (riskScore >= 0.8) return '#ff4444';
    if (riskScore >= 0.6) return '#ff8800';
    if (riskScore >= 0.4) return '#ffaa00';
    if (riskScore >= 0.2) return '#88cc00';
    return '#44cc44';
  };

  if (!user) {
    return <div>로그인이 필요합니다.</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>대시보드</h1>
        <p>안녕하세요, {user.name}님! 현재 위치의 싱크홀 위험도를 확인해보세요.</p>
      </div>

      <div className="dashboard-content">
        <div className="current-location-card">
          <h2>📍 현재 위치</h2>
          {currentLocation ? (
            <div className="location-info">
              <p><strong>위도:</strong> {currentLocation.latitude.toFixed(6)}</p>
              <p><strong>경도:</strong> {currentLocation.longitude.toFixed(6)}</p>
              <button onClick={getCurrentLocation} className="refresh-btn">
                위치 새로고침
              </button>
            </div>
          ) : (
            <p>위치 정보를 가져오는 중...</p>
          )}
        </div>

        <div className="risk-prediction-card">
          <h2>🔍 위험도 예측</h2>
          {loading ? (
            <p>예측 중...</p>
          ) : riskData ? (
            <div className="risk-result">
              <div 
                className="risk-score"
                style={{ backgroundColor: getRiskColor(riskData.risk_score) }}
              >
                <span className="score-value">{(riskData.risk_score * 100).toFixed(1)}%</span>
                <span className="risk-level">{riskData.risk_level}</span>
              </div>
              <p className="risk-message">{riskData.message}</p>
            </div>
          ) : (
            <p>위치 정보를 확인한 후 위험도를 예측합니다.</p>
          )}
        </div>

        <div className="manual-location-card">
          <h2>🎯 특정 위치 검색</h2>
          <form onSubmit={handleManualLocationCheck}>
            <div className="input-group">
              <label>위도:</label>
              <input
                type="number"
                step="any"
                value={locationInput.latitude}
                onChange={(e) => setLocationInput({...locationInput, latitude: e.target.value})}
                placeholder="37.5665 (서울시청 예시)"
              />
            </div>
            <div className="input-group">
              <label>경도:</label>
              <input
                type="number"
                step="any"
                value={locationInput.longitude}
                onChange={(e) => setLocationInput({...locationInput, longitude: e.target.value})}
                placeholder="126.9780 (서울시청 예시)"
              />
            </div>
            <button type="submit" disabled={loading}>위험도 확인</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;