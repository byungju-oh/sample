# main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import uvicorn
from datetime import datetime, timedelta
import random
import math

from database import SessionLocal, engine, Base
from models import User, Location, RiskPrediction
from schemas import UserCreate, UserResponse, LocationRequest, RiskResponse, RouteRequest, RouteResponse
from auth import get_password_hash, verify_password, create_access_token, get_current_user

# 데이터베이스 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Seoul Sinkhole Prediction API", version="1.0.0")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React 개발 서버
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# 데이터베이스 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 서울시 더미 위험지역 데이터 (실제 좌표 기반)
DUMMY_RISK_ZONES = [
    {"lat": 37.5665, "lng": 126.9780, "risk": 0.85, "name": "중구 명동"},
    {"lat": 37.5663, "lng": 126.9779, "risk": 0.90, "name": "중구 명동 인근"},
    {"lat": 37.5519, "lng": 126.9918, "risk": 0.78, "name": "강남구 논현동"},
    {"lat": 37.5172, "lng": 127.0473, "risk": 0.82, "name": "강남구 삼성동"},
    {"lat": 37.5794, "lng": 126.9770, "risk": 0.75, "name": "종로구 종로1가"},
    {"lat": 37.5512, "lng": 126.9882, "risk": 0.88, "name": "서초구 서초동"},
    {"lat": 37.5326, "lng": 126.9026, "risk": 0.73, "name": "영등포구 여의도동"},
    {"lat": 37.5838, "lng": 127.0580, "risk": 0.80, "name": "성동구 성수동"},
    {"lat": 37.5145, "lng": 126.9061, "risk": 0.77, "name": "관악구 신림동"},
    {"lat": 37.6065, "lng": 127.0921, "risk": 0.84, "name": "동대문구 청량리동"},
]

@app.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """회원가입"""
    # 중복 사용자 확인
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # 새 사용자 생성
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return UserResponse(id=db_user.id, email=db_user.email, name=db_user.name)

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """로그인"""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """현재 사용자 정보"""
    return UserResponse(id=current_user.id, email=current_user.email, name=current_user.name)

@app.post("/predict-risk", response_model=RiskResponse)
async def predict_sinkhole_risk(
    location: LocationRequest, 
    db: Session = Depends(get_db)
):
    """지정 위치의 싱크홀 위험도 예측 (로그인 불필요)"""
    
    # 주변 위험지역과의 거리 기반으로 위험도 계산
    min_distance = float('inf')
    nearest_risk = 0.0
    
    for zone in DUMMY_RISK_ZONES:
        distance = calculate_distance(location.latitude, location.longitude, zone["lat"], zone["lng"])
        if distance < min_distance:
            min_distance = distance
            nearest_risk = zone["risk"]
    
    # 거리에 따른 위험도 조정 (가까울수록 높은 위험도)
    if min_distance < 0.5:  # 500m 이내
        risk_score = max(0.7, nearest_risk)
    elif min_distance < 1.0:  # 1km 이내
        risk_score = max(0.4, nearest_risk * 0.7)
    elif min_distance < 2.0:  # 2km 이내
        risk_score = max(0.2, nearest_risk * 0.5)
    else:
        risk_score = min(0.3, random.uniform(0.1, 0.3))
    
    # 예측 결과는 DB에 저장하지 않음 (로그인 불필요하므로)
    
    return RiskResponse(
        latitude=location.latitude,
        longitude=location.longitude,
        risk_score=round(risk_score, 3),
        risk_level=get_risk_level(risk_score),
        message=get_risk_message(risk_score)
    )

@app.get("/risk-zones")
async def get_risk_zones():
    """서울시 위험지역 목록 반환 (로그인 불필요)"""
    return {
        "zones": DUMMY_RISK_ZONES,
        "total_count": len(DUMMY_RISK_ZONES)
    }

@app.post("/safe-route", response_model=RouteResponse)
async def get_safe_route(route_request: RouteRequest):
    """위험지역을 우회하는 안전 경로 생성 (로그인 불필요)"""
    
    start_lat, start_lng = route_request.start_latitude, route_request.start_longitude
    end_lat, end_lng = route_request.end_latitude, route_request.end_longitude
    
    # 직선 경로상의 위험지역 확인
    dangerous_zones = []
    for zone in DUMMY_RISK_ZONES:
        if is_point_near_line(start_lat, start_lng, end_lat, end_lng, zone["lat"], zone["lng"], 0.5):
            if zone["risk"] > 0.7:
                dangerous_zones.append(zone)
    
    # 안전 경로 생성 (위험지역 우회)
    if dangerous_zones:
        # 우회 경로 생성 (시뮬레이션)
        waypoints = generate_safe_waypoints(start_lat, start_lng, end_lat, end_lng, dangerous_zones)
        route_type = "safe_detour"
        message = f"{len(dangerous_zones)}개의 위험지역을 우회하는 경로입니다."
    else:
        # 직선 경로
        waypoints = [
            {"lat": start_lat, "lng": start_lng},
            {"lat": end_lat, "lng": end_lng}
        ]
        route_type = "direct"
        message = "위험지역이 없어 직선 경로를 제공합니다."
    
    return RouteResponse(
        waypoints=waypoints,
        distance=calculate_distance(start_lat, start_lng, end_lat, end_lng),
        estimated_time=estimate_travel_time(waypoints),
        route_type=route_type,
        avoided_zones=dangerous_zones,
        message=message
    )

# 유틸리티 함수들
def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """두 좌표 간 거리 계산 (km)"""
    R = 6371  # 지구 반지름 (km)
    
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    
    a = (math.sin(dlat/2) * math.sin(dlat/2) + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
         math.sin(dlng/2) * math.sin(dlng/2))
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def get_risk_level(risk_score: float) -> str:
    """위험도 점수에 따른 등급 반환"""
    if risk_score >= 0.8:
        return "매우높음"
    elif risk_score >= 0.6:
        return "높음"
    elif risk_score >= 0.4:
        return "보통"
    elif risk_score >= 0.2:
        return "낮음"
    else:
        return "매우낮음"

def get_risk_message(risk_score: float) -> str:
    """위험도에 따른 메시지 반환"""
    if risk_score >= 0.8:
        return "매우 위험한 지역입니다. 우회 경로를 이용하세요."
    elif risk_score >= 0.6:
        return "위험도가 높은 지역입니다. 주의가 필요합니다."
    elif risk_score >= 0.4:
        return "보통 수준의 위험도입니다."
    elif risk_score >= 0.2:
        return "비교적 안전한 지역입니다."
    else:
        return "매우 안전한 지역입니다."

def is_point_near_line(x1: float, y1: float, x2: float, y2: float, px: float, py: float, threshold: float) -> bool:
    """점이 직선 근처에 있는지 확인"""
    # 점과 직선 사이의 거리 계산
    A = y2 - y1
    B = x1 - x2
    C = x2 * y1 - x1 * y2
    
    distance = abs(A * px + B * py + C) / math.sqrt(A * A + B * B)
    return distance < threshold

def generate_safe_waypoints(start_lat: float, start_lng: float, end_lat: float, end_lng: float, dangerous_zones: list) -> list:
    """위험지역을 우회하는 경유지 생성"""
    waypoints = [{"lat": start_lat, "lng": start_lng}]
    
    # 간단한 우회 로직 (실제로는 더 복잡한 경로 찾기 알고리즘 필요)
    mid_lat = (start_lat + end_lat) / 2
    mid_lng = (start_lng + end_lng) / 2
    
    # 위험지역 근처에서 우회점 생성
    for zone in dangerous_zones:
        if calculate_distance(mid_lat, mid_lng, zone["lat"], zone["lng"]) < 1.0:
            # 우회점 추가 (위험지역에서 1km 떨어진 지점)
            offset_lat = 0.01 if zone["lat"] > mid_lat else -0.01
            offset_lng = 0.01 if zone["lng"] > mid_lng else -0.01
            
            waypoints.append({
                "lat": zone["lat"] + offset_lat,
                "lng": zone["lng"] + offset_lng
            })
    
    waypoints.append({"lat": end_lat, "lng": end_lng})
    return waypoints

def estimate_travel_time(waypoints: list) -> int:
    """경로의 예상 소요시간 계산 (분)"""
    total_distance = 0
    for i in range(len(waypoints) - 1):
        total_distance += calculate_distance(
            waypoints[i]["lat"], waypoints[i]["lng"],
            waypoints[i+1]["lat"], waypoints[i+1]["lng"]
        )
    
    # 평균 속도 30km/h로 가정
    return int(total_distance / 30 * 60)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)