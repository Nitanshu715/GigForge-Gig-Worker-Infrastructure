-- GigForge Production Schema
-- Run on Neon DB (PostgreSQL) for Part 1 free deployment
-- Run on AWS RDS Aurora for Part 2 production

-- Workers
CREATE TABLE IF NOT EXISTS workers (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  platform      TEXT NOT NULL,
  vehicle_type  TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  city          TEXT NOT NULL,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE,
  is_verified   BOOLEAN DEFAULT FALSE
);

-- Rides
CREATE TABLE IF NOT EXISTS rides (
  id               TEXT PRIMARY KEY,
  worker_id        TEXT REFERENCES workers(id),
  type             TEXT NOT NULL CHECK (type IN ('ride_accepted','ride_completed','ride_cancelled')),
  platform         TEXT NOT NULL,
  ride_id          TEXT NOT NULL,
  pickup_location  TEXT,
  drop_location    TEXT,
  distance_km      NUMERIC(8,2),
  fare_amount      NUMERIC(10,2),
  duration_minutes INTEGER,
  rating           NUMERIC(3,2),
  timestamp        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rides_worker ON rides(worker_id);
CREATE INDEX IF NOT EXISTS idx_rides_type ON rides(type);
CREATE INDEX IF NOT EXISTS idx_rides_timestamp ON rides(timestamp DESC);

-- Ledger (APPEND-ONLY — never update, only insert)
CREATE TABLE IF NOT EXISTS ledger (
  id          TEXT PRIMARY KEY,
  worker_id   TEXT REFERENCES workers(id),
  type        TEXT NOT NULL CHECK (type IN ('HR','Insurance')),
  amount      NUMERIC(10,4) NOT NULL,
  event_type  TEXT NOT NULL,
  ride_id     TEXT,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  balance     NUMERIC(12,4) NOT NULL,
  description TEXT NOT NULL,
  block_hash  TEXT
);

CREATE INDEX IF NOT EXISTS idx_ledger_worker ON ledger(worker_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger(type);
CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON ledger(timestamp DESC);

-- Shifts
CREATE TABLE IF NOT EXISTS shifts (
  id               TEXT PRIMARY KEY,
  worker_id        TEXT REFERENCES workers(id),
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ,
  duration_minutes INTEGER,
  fatigue_level    TEXT CHECK (fatigue_level IN ('Low','Moderate','High','Critical')),
  status           TEXT DEFAULT 'active' CHECK (status IN ('active','completed'))
);

CREATE INDEX IF NOT EXISTS idx_shifts_worker ON shifts(worker_id);

-- Insurance claims
CREATE TABLE IF NOT EXISTS claims (
  id                TEXT PRIMARY KEY,
  worker_id         TEXT REFERENCES workers(id),
  type              TEXT NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  description       TEXT NOT NULL,
  status            TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Under Review','Approved','Rejected')),
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  payout_amount     NUMERIC(12,2),
  eligibility_score INTEGER NOT NULL,
  documents         TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_claims_worker ON claims(worker_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- OTP store
CREATE TABLE IF NOT EXISTS otps (
  identifier  TEXT NOT NULL,
  otp         TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_identifier ON otps(identifier);
