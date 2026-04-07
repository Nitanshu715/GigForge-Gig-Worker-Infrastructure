# GigForge

**Gig Worker Infrastructure Platform**

A production-grade HR, insurance, and benefits system for India's 25–30 million gig workers. Every ride accepted or completed automatically generates micro-contributions to a worker's HR fund and insurance pool — creating the structured benefits layer that gig workers have never had.

---

## Why this exists

Gig workers on Swiggy, Zomato, Uber, and Rapido earn through every delivery — but nothing accumulates. No HR record. No insurance tracking. No work history. No financial safety net. Full-time employees get all of this through payroll. GigForge gives gig workers the same infrastructure, triggered by their own ride events.

---

## What it does

Every time a worker accepts, completes, or cancels a task:

- A micro HR contribution (₹0.50–₹1.00) is generated
- A micro insurance contribution (₹0.50–₹1.00) is generated
- An immutable ledger entry is written with a block hash
- The worker's reliability and risk scores are recalculated
- Working hours and fatigue are tracked per shift

Over time, workers build a real HR fund and insurance pool — directly tied to their work activity.

---

## Contribution model

| Event | HR | Insurance |
|---|---|---|
| ride_accepted | ₹0.50 | ₹0.50 |
| ride_completed | ₹1.00 | ₹1.00 |
| ride_cancelled | ₹0.00 | Reliability affected |

---

## Platform structure

One URL, two roles. Workers and admins use the same platform — role is determined at login.

**Worker side** — Dashboard, Ride controls, Working hours, Contributions, Insurance claims, Ledger, Activity log, Profile

**Admin side** — System overview, All workers, Claims review queue, Platform ledger, Ride events, Analytics, Part 2 architecture guide

---

## Tech stack

### Part 1 — Free deployment

| Layer | Tech | Cost |
|---|---|---|
| Frontend + API routes | Next.js 14 | Free |
| OTP email delivery | Resend | Free (3,000/month) |
| Hosting | Vercel | Free |
| Database (production) | Neon DB (PostgreSQL) | Free |
| Event queue | Upstash Redis | Free |
| Backend API | FastAPI | Free (Render) |

### Part 2 — Production (paid infra)

Apache Kafka (AWS MSK) → 6 microservices on AWS EKS → PostgreSQL Aurora → Redis ElastiCache → ClickHouse analytics → Prometheus + Grafana + ELK observability. Full architecture documented live inside the admin panel under "Part 2 — Paid".

---

## Quick start

```bash
cd gigforge-app
npm install
npm run dev
```

Open `http://localhost:3000`. Select your role on the landing page.

---

## Setting up real OTP emails

GigForge uses [Resend](https://resend.com) for email delivery. Free tier: 3,000 emails/month, no credit card required.

Without a Resend key (dev mode), the OTP is shown on screen in an info box so you can still test everything. With a key, OTP goes to email only — nothing on screen.

### Enable real emails in 3 steps

**Step 1 — Get a free Resend API key**

Go to [resend.com](https://resend.com) → sign up (free) → API Keys → Create API Key → copy it.

**Step 2 — Create your `.env.local`**

```bash
cd gigforge-app
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=GigForge <onboarding@resend.dev>
```

**Step 3 — Run and test**

```bash
npm run dev
```

Sign up with your real email. The OTP will arrive in your inbox — the dev mode info box is gone.

**Important note on `onboarding@resend.dev`:** During testing this only delivers to your own Resend-verified email. To send to any email address, verify your domain at [resend.com/domains](https://resend.com/domains) and update `FROM_EMAIL` to `GigForge <noreply@yourdomain.com>`.

---

## Deploy to Vercel — get your single live link

### Option A — GitHub (recommended)

1. Push this entire repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import your repo
3. Set **Root Directory** to `gigforge-app`
4. Add environment variables in Vercel dashboard:
   - `RESEND_API_KEY` → your key
   - `FROM_EMAIL` → `GigForge <onboarding@resend.dev>`
5. Click Deploy

You get one URL like `gigforge.vercel.app`. Drivers and admins both use it. Role is selected on the landing page.

### Option B — Vercel CLI

```bash
cd gigforge-app
npm install -g vercel
vercel
```

Then: Vercel Dashboard → your project → Settings → Environment Variables → add `RESEND_API_KEY` and `FROM_EMAIL` → Deployments → Redeploy.

---

## Authentication

### Worker (driver)

- Sign up with name, email, phone, vehicle details — OTP sent to email
- After signup: "Account created" screen → then manual login
- Forgot password: OTP to registered email → choose new password
- Dev shortcut: `driver@gmail.com` / `driver` — skips OTP entirely

### Admin

- Select "I am an administrator" on the landing page
- Enter email + administrator password → OTP sent to email → in
- No signup screen, no forgot password (fixed credentials by design)
- Administrator password: `GigForge@Admin2024`
- Dev OTP bypass: enter `000000` on any OTP screen

---

## Project structure

```
gigforge-app/
├── app/
│   ├── page.tsx              Role router — renders WorkerShell or AdminShell
│   ├── layout.tsx
│   ├── globals.css           Design system, CSS variables, animations
│   └── api/otp/route.ts      POST (send OTP via Resend) + PUT (verify OTP)
│
├── components/
│   ├── AuthScreen.tsx        Unified auth — all flows for both roles
│   ├── ui/index.tsx          Design system components
│   ├── worker/WorkerShell.tsx   All 8 worker views
│   └── admin/AdminShell.tsx     All 7 admin views + Part 2 architecture
│
└── lib/
    ├── store.ts              Data layer (localStorage → swap for DB)
    └── otp.ts                OTP client — calls /api/otp
```

---

## Backend API

The frontend works entirely on localStorage without the backend. For Part 2, connect the backend to real databases.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Docs at http://localhost:8000/docs
# SQLite is auto-created locally if DATABASE_URL is not set
```

---

## Ledger design

The financial ledger is append-only — no record is ever modified or deleted. Each entry carries a block hash derived from `worker_id + timestamp + amount`, making the ledger tamper-evident. In Part 2, Kafka enables full event replay to reconstruct system state at any point in time.

---

## Part 2 migration — from free to production

The codebase is built so migration only requires changing environment variables:

1. Replace Upstash Redis Pub/Sub with AWS MSK (Kafka) — zero application logic changes
2. Migrate Neon DB to RDS Aurora — `pg_dump` + restore, update `DATABASE_URL`
3. Deploy 6 microservices on AWS EKS — each service is already containerized
4. Add Prometheus + Grafana via Helm charts for observability
5. Enable Worker Intelligence Service for AI-based risk scoring

Full step-by-step migration guide is documented inside the admin panel → "Part 2 — Paid".

---

## GitHub description

> Production-grade HR and insurance infrastructure for India's gig economy. Event-driven micro-contributions per ride, real OTP email auth, append-only financial ledger, role-based worker and admin portals — built for 25M+ gig workers by 2030.
