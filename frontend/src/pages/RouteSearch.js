import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import { toast } from 'react-toastify';
import axios from 'axios';
import L from 'leaflet';
import '../styles/RouteSearch.css';

// 아이콘 설정
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const RouteSearch = () => {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);

  // 서울시 주요 장소 좌표 (검색 편의용)
  const seoulPlaces = {
    '서울시청': { lat: 37.5665, lng: 126.9780 },
    '강남역': { lat: 37.4979, lng: 127.0276 },
    '홍대입구역': { lat: 37.5574, lng: 126.9240 },
    '명동': { lat: 37.5636, lng: 126.9826 },
    '잠실역': { lat: 37.5134, lng: 127.1000 },
    '종로3가': { lat: 37.5703, lng: 126.9925 },
    '이태원': { lat: 37.5347, lng: 126.9947 },
    '신촌': { lat: 37.5558, lng: 126.9364 },
    '여의도': { lat: 37.5219, lng: 126.9245 },
    '청량리': { lat: 37.5800, lng: 127.0410 }
  };

  const parseLocation = (locationStr) => {
    // 좌표 형식 (위도,경도) 확인
    const coordMatch = locationStr.match(/([0-9.]+),\s*([0-9.]+)/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2])
      };
    }
    
    // 등록된 장소명 확인
    const place = seoulPlaces[locationStr];
    if (place) {
      return place;
    }
    
    return null;
  };

  const handleSearch = async () => {
    const start = parseLocation(startLocation);
    const end = parseLocation(endLocation);
    
    if (!start || !end) {
      toast.error('출발지와 도착지를 올바르게 입력해주세요. (예: 37.5665,126.9780 또는 서울시청)');
      return;
    }
    
    setStartCoords(start);
    setEndCoords(end);
    setLoading(true);
    
    try {
      const response = await axios.post('/safe-route', {
        start_latitude: start.lat,
        start_longitude: start.lng,
        end_latitude: end.lat,
        end_longitude: end.lng
      });
      
      setRoute(response.data);
      toast.success(response.data.message);
    } catch (error) {
      console.error('경로 검색 에러:', error);
      toast.error('경로 검색 실패: ' + (error.response?.data?.detail || '서버 오류'));
    } finally {
      setLoading(false);
    }
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
          setStartLocation(coords);
        },
        (error) => {
          toast.error('현재 위치를 가져올 수 없습니다: ' + error.message);
        }
      );
    } else {
      toast.error('이 브라우저는 위치 서비스를 지원하지 않습니다.');
    }
  };

  const getRiskColor = (risk) => {
    if (risk >= 0.8) return '#ff4444';
    if (risk >= 0.6) return '#ff8800';
    if (risk >= 0.4) return '#ffaa00';
    return '#88cc00';
  };

  return (
    <div className="route-search-container">
      <div className="search-panel">
        <h1>안전 경로 검색</h1>
        <p>로그인 없이 누구나 이용 가능합니다</p>
        
        <div className="search-form">
          <div className="input-group">
            <label>출발지:</label>
            <div className="input-with-button">
              <input
                type="text"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                placeholder="예: 37.5665,126.9780 또는 서울시청"
              />
              <button onClick={handleCurrentLocation} className="current-location-btn">
                현재위치
              </button>
            </div>
          </div>
          
          <div className="input-group">
            <label>도착지:</label>
            <input
              type="text"
              value={endLocation}
              onChange={(e) => setEndLocation(e.target.value)}
              placeholder="예: 37.4979,127.0276 또는 강남역"
            />
          </div>
          
          <button 
            onClick={handleSearch} 
            disabled={loading}
            className="search-btn"
          >
            {loading ? '검색 중...' : '안전 경로 검색'}
          </button>
        </div>

        <div className="places-help">
          <h3>주요 장소 바로가기</h3>
          <div className="places-grid">
            {Object.keys(seoulPlaces).map(place => (
              <button
                key={place}
                onClick={() => setEndLocation(place)}
                className="place-btn"
              >
                {place}
              </button>
            ))}
          </div>
        </div>

        {route && (
          <div className="route-info">
            <h3>경로 정보</h3>
            <div className="route-details">
              <p><strong>경로 타입:</strong> {route.route_type === 'direct' ? '직선 경로' : '우회 경로'}</p>
              <p><strong>총 거리:</strong> {route.distance.toFixed(2)} km</p>
              <p><strong>예상 시간:</strong> {route.estimated_time}분</p>
              <p><strong>우회한 위험지역:</strong> {route.avoided_zones.length}개</p>
            </div>
            
            {route.avoided_zones.length > 0 && (
              <div className="avoided-zones">
                <h4>우회한 위험지역:</h4>
                <ul>
                  {route.avoided_zones.map((zone, index) => (
                    <li key={index}>
                      {zone.name} (위험도: {(zone.risk * 100).toFixed(1)}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="map-container">
        <MapContainer
          center={[37.5665, 126.9780]}
          zoom={11}
          style={{ height: '600px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {startCoords && (
            <Marker position={[startCoords.lat, startCoords.lng]}>
              <Popup>출발지</Popup>
            </Marker>
          )}
          
          {endCoords && (
            <Marker position={[endCoords.lat, endCoords.lng]}>
              <Popup>도착지</Popup>
            </Marker>
          )}
          
          {route && (
            <>
              <Polyline
                positions={route.waypoints.map(wp => [wp.lat, wp.lng])}
                color={route.route_type === 'direct' ? 'blue' : 'green'}
                weight={4}
                opacity={0.7}
              />
              
              {route.avoided_zones.map((zone, index) => (
                <CircleMarker
                  key={index}
                  center={[zone.lat, zone.lng]}
                  radius={15}
                  color={getRiskColor(zone.risk)}
                  fillColor={getRiskColor(zone.risk)}
                  fillOpacity={0.6}
                >
                  <Popup>
                    <div>
                      <h4>{zone.name}</h4>
                      <p>위험도: {(zone.risk * 100).toFixed(1)}%</p>
                      <p>이 지역을 우회합니다</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default RouteSearch;