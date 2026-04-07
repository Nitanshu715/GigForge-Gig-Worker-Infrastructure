"""
GigForge Backend API — Production-ready FastAPI service
Connect to Neon DB (PostgreSQL) + Upstash Redis for full stack operation.
Run locally: uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime, timedelta
from enum import Enum
import os, hashlib, uuid, json

# ── SQLite fallback for local dev (swap for PostgreSQL in prod) ───────────────
try:
    import sqlalchemy as sa
    from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./gigforge_dev.db")
    engine = sa.create_engine(DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://") if "postgresql" in DATABASE_URL else DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    class Base(DeclarativeBase):
        pass

    class WorkerModel(Base):
        __tablename__ = "workers"
        id = sa.Column(sa.String, primary_key=True)
        name = sa.Column(sa.String, nullable=False)
        email = sa.Column(sa.String, unique=True, nullable=False)
        phone = sa.Column(sa.String, unique=True, nullable=False)
        password_hash = sa.Column(sa.String, nullable=False)
        platform = sa.Column(sa.String, nullable=False)
        vehicle_type = sa.Column(sa.String, nullable=False)
        vehicle_number = sa.Column(sa.String, nullable=False)
        city = sa.Column(sa.String, nullable=False)
        joined_at = sa.Column(sa.String, default=lambda: datetime.utcnow().isoformat())
        is_active = sa.Column(sa.Boolean, default=True)

    class LedgerModel(Base):
        __tablename__ = "ledger"
        id = sa.Column(sa.String, primary_key=True)
        worker_id = sa.Column(sa.String, sa.ForeignKey("workers.id"), nullable=False)
        type = sa.Column(sa.String, nullable=False)  # HR | Insurance
        amount = sa.Column(sa.Float, nullable=False)
        event_type = sa.Column(sa.String, nullable=False)
        ride_id = sa.Column(sa.String, nullable=True)
        timestamp = sa.Column(sa.String, default=lambda: datetime.utcnow().isoformat())
        balance = sa.Column(sa.Float, nullable=False)
        description = sa.Column(sa.String, nullable=False)
        block_hash = sa.Column(sa.String, nullable=True)

    class RideModel(Base):
        __tablename__ = "rides"
        id = sa.Column(sa.String, primary_key=True)
        worker_id = sa.Column(sa.String, sa.ForeignKey("workers.id"), nullable=False)
        type = sa.Column(sa.String, nullable=False)
        platform = sa.Column(sa.String, nullable=False)
        ride_id = sa.Column(sa.String, nullable=False)
        pickup_location = sa.Column(sa.String, nullable=True)
        drop_location = sa.Column(sa.String, nullable=True)
        distance_km = sa.Column(sa.Float, nullable=True)
        fare_amount = sa.Column(sa.Float, nullable=True)
        timestamp = sa.Column(sa.String, default=lambda: datetime.utcnow().isoformat())

    class ClaimModel(Base):
        __tablename__ = "claims"
        id = sa.Column(sa.String, primary_key=True)
        worker_id = sa.Column(sa.String, sa.ForeignKey("workers.id"), nullable=False)
        type = sa.Column(sa.String, nullable=False)
        amount = sa.Column(sa.Float, nullable=False)
        description = sa.Column(sa.String, nullable=False)
        status = sa.Column(sa.String, default="Pending")
        submitted_at = sa.Column(sa.String, default=lambda: datetime.utcnow().isoformat())
        reviewed_at = sa.Column(sa.String, nullable=True)
        payout_amount = sa.Column(sa.Float, nullable=True)
        eligibility_score = sa.Column(sa.Integer, nullable=False)

    Base.metadata.create_all(bind=engine)

    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    DB_AVAILABLE = True
except Exception as e:
    print(f"DB not available: {e}")
    DB_AVAILABLE = False

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="GigForge API",
    description="Gig Worker Infrastructure Platform — HR, Insurance, Event Tracking",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Contribution rates (core business logic) ──────────────────────────────────

CONTRIBUTIONS = {
    "ride_accepted":  {"hr": 0.50, "insurance": 0.50},
    "ride_completed": {"hr": 1.00, "insurance": 1.00},
    "ride_cancelled": {"hr": 0.00, "insurance": 0.00},
}

def make_block_hash(worker_id: str, timestamp: str, amount: float, suffix: str = "") -> str:
    data = f"{worker_id}{timestamp}{amount}{suffix}"
    return hashlib.sha256(data.encode()).hexdigest()[:16]

def gen_id() -> str:
    return str(uuid.uuid4()).replace("-", "")[:12]

def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def verify_password(pw: str, hashed: str) -> bool:
    return hash_password(pw) == hashed

# ── Schemas ───────────────────────────────────────────────────────────────────

class WorkerRegister(BaseModel):
    name: str
    email: str
    phone: str
    password: str
    platform: str
    vehicle_type: str
    vehicle_number: str
    city: str

class WorkerLogin(BaseModel):
    identifier: str  # email or phone
    password: str

class RideEventPayload(BaseModel):
    worker_id: str
    event_type: Literal["ride_accepted", "ride_completed", "ride_cancelled"]
    platform: str
    pickup_location: Optional[str] = None
    drop_location: Optional[str] = None
    distance_km: Optional[float] = None
    fare_amount: Optional[float] = None

class ClaimPayload(BaseModel):
    worker_id: str
    type: str
    amount: float
    description: str

class ClaimReview(BaseModel):
    claim_id: str
    status: Literal["Approved", "Rejected", "Under Review"]
    payout_amount: Optional[float] = None
    notes: Optional[str] = None

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "GigForge API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "architecture": "Part 1 (Free MVP) — FastAPI + PostgreSQL + Redis",
    }

@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat(), "db": DB_AVAILABLE}

# ── Worker auth ───────────────────────────────────────────────────────────────

@app.post("/api/workers/register")
def register_worker(payload: WorkerRegister, db: Session = Depends(get_db)):
    existing = db.query(WorkerModel).filter(
        (WorkerModel.email == payload.email) | (WorkerModel.phone == payload.phone)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Worker already exists with this email or phone.")

    worker = WorkerModel(
        id=gen_id(),
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        platform=payload.platform,
        vehicle_type=payload.vehicle_type,
        vehicle_number=payload.vehicle_number,
        city=payload.city,
    )
    db.add(worker)
    db.commit()
    return {"success": True, "worker_id": worker.id, "message": "Account created. Please log in."}

@app.post("/api/workers/login")
def login_worker(payload: WorkerLogin, db: Session = Depends(get_db)):
    worker = db.query(WorkerModel).filter(
        (WorkerModel.email == payload.identifier) | (WorkerModel.phone == payload.identifier)
    ).first()
    if not worker or not verify_password(payload.password, worker.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    return {
        "success": True,
        "worker": {
            "id": worker.id,
            "name": worker.name,
            "email": worker.email,
            "phone": worker.phone,
            "platform": worker.platform,
            "city": worker.city,
        }
    }

@app.get("/api/workers/{worker_id}/stats")
def get_worker_stats(worker_id: str, db: Session = Depends(get_db)):
    ledger = db.query(LedgerModel).filter(LedgerModel.worker_id == worker_id).all()
    rides = db.query(RideModel).filter(RideModel.worker_id == worker_id).all()

    hr_fund = sum(l.amount for l in ledger if l.type == "HR")
    ins_fund = sum(l.amount for l in ledger if l.type == "Insurance")
    completed = sum(1 for r in rides if r.type == "ride_completed")
    cancelled = sum(1 for r in rides if r.type == "ride_cancelled")
    total = len(rides)
    reliability = round((completed / total) * 100) if total > 0 else 85

    return {
        "worker_id": worker_id,
        "total_rides": total,
        "completed_rides": completed,
        "cancelled_rides": cancelled,
        "hr_fund": hr_fund,
        "insurance_fund": ins_fund,
        "reliability_score": reliability,
        "risk_score": max(5, min(95, 100 - reliability)),
    }

# ── Ride events ───────────────────────────────────────────────────────────────

@app.post("/api/rides/event")
def process_ride_event(payload: RideEventPayload, db: Session = Depends(get_db)):
    """
    Core event processor. In Part 2 (production), this publishes to Kafka
    and the contribution service consumes asynchronously.
    In Part 1, we process synchronously.
    """
    timestamp = datetime.utcnow().isoformat()
    ride_id = gen_id()
    contrib = CONTRIBUTIONS[payload.event_type]

    # Log the ride event
    ride = RideModel(
        id=gen_id(),
        worker_id=payload.worker_id,
        type=payload.event_type,
        platform=payload.platform,
        ride_id=ride_id,
        pickup_location=payload.pickup_location,
        drop_location=payload.drop_location,
        distance_km=payload.distance_km,
        fare_amount=payload.fare_amount,
    )
    db.add(ride)

    ledger_entries = []

    # Get current balances
    existing = db.query(LedgerModel).filter(LedgerModel.worker_id == payload.worker_id).all()
    hr_balance = sum(l.amount for l in existing if l.type == "HR")
    ins_balance = sum(l.amount for l in existing if l.type == "Insurance")

    # Append ledger entries (never update — always insert)
    if contrib["hr"] > 0:
        hr_entry = LedgerModel(
            id=gen_id(),
            worker_id=payload.worker_id,
            type="HR",
            amount=contrib["hr"],
            event_type=payload.event_type,
            ride_id=ride_id,
            timestamp=timestamp,
            balance=hr_balance + contrib["hr"],
            description=f"HR contribution — {payload.event_type.replace('_', ' ')}",
            block_hash=make_block_hash(payload.worker_id, timestamp, contrib["hr"]),
        )
        db.add(hr_entry)
        ledger_entries.append({"type": "HR", "amount": contrib["hr"]})

    if contrib["insurance"] > 0:
        ins_entry = LedgerModel(
            id=gen_id(),
            worker_id=payload.worker_id,
            type="Insurance",
            amount=contrib["insurance"],
            event_type=payload.event_type,
            ride_id=ride_id,
            timestamp=timestamp,
            balance=ins_balance + contrib["insurance"],
            description=f"Insurance premium — {payload.event_type.replace('_', ' ')}",
            block_hash=make_block_hash(payload.worker_id, timestamp, contrib["insurance"], "ins"),
        )
        db.add(ins_entry)
        ledger_entries.append({"type": "Insurance", "amount": contrib["insurance"]})

    db.commit()

    return {
        "success": True,
        "event_type": payload.event_type,
        "ride_id": ride_id,
        "contributions": ledger_entries,
        "system_note": "Part 1: sync processing. Part 2: Kafka → consumer → ledger write.",
    }

# ── Claims ────────────────────────────────────────────────────────────────────

@app.post("/api/claims")
def file_claim(payload: ClaimPayload, db: Session = Depends(get_db)):
    ledger = db.query(LedgerModel).filter(LedgerModel.worker_id == payload.worker_id).all()
    rides = db.query(RideModel).filter(RideModel.worker_id == payload.worker_id).all()
    completed = sum(1 for r in rides if r.type == "ride_completed")
    reliability = round((completed / len(rides)) * 100) if rides else 85
    eligibility = min(100, round(reliability * 0.8 + completed * 0.2))

    claim = ClaimModel(
        id=gen_id(),
        worker_id=payload.worker_id,
        type=payload.type,
        amount=payload.amount,
        description=payload.description,
        eligibility_score=eligibility,
    )
    db.add(claim)
    db.commit()
    return {"success": True, "claim_id": claim.id, "eligibility_score": eligibility}

@app.get("/api/claims/{worker_id}")
def get_claims(worker_id: str, db: Session = Depends(get_db)):
    claims = db.query(ClaimModel).filter(ClaimModel.worker_id == worker_id).all()
    return [{"id":c.id,"type":c.type,"amount":c.amount,"status":c.status,"eligibility_score":c.eligibility_score,"submitted_at":c.submitted_at} for c in claims]

@app.put("/api/claims/review")
def review_claim(payload: ClaimReview, db: Session = Depends(get_db)):
    claim = db.query(ClaimModel).filter(ClaimModel.id == payload.claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found.")
    claim.status = payload.status
    claim.reviewed_at = datetime.utcnow().isoformat()
    claim.payout_amount = payload.payout_amount
    db.commit()
    return {"success": True}

# ── Admin ─────────────────────────────────────────────────────────────────────

@app.get("/api/admin/overview")
def admin_overview(db: Session = Depends(get_db)):
    workers = db.query(WorkerModel).all()
    ledger = db.query(LedgerModel).all()
    rides = db.query(RideModel).all()
    claims = db.query(ClaimModel).all()
    return {
        "total_workers": len(workers),
        "total_rides": len(rides),
        "completed_rides": sum(1 for r in rides if r.type == "ride_completed"),
        "total_hr_pool": sum(l.amount for l in ledger if l.type == "HR"),
        "total_insurance_pool": sum(l.amount for l in ledger if l.type == "Insurance"),
        "pending_claims": sum(1 for c in claims if c.status == "Pending"),
        "total_ledger_entries": len(ledger),
    }

@app.get("/api/admin/workers")
def admin_workers(db: Session = Depends(get_db)):
    workers = db.query(WorkerModel).all()
    result = []
    for w in workers:
        ledger = db.query(LedgerModel).filter(LedgerModel.worker_id == w.id).all()
        rides = db.query(RideModel).filter(RideModel.worker_id == w.id).all()
        result.append({
            "id": w.id, "name": w.name, "email": w.email,
            "platform": w.platform, "city": w.city,
            "total_rides": len(rides),
            "hr_fund": sum(l.amount for l in ledger if l.type == "HR"),
            "insurance_fund": sum(l.amount for l in ledger if l.type == "Insurance"),
        })
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
