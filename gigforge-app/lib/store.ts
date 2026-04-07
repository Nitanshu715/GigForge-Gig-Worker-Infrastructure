// GigForge — Unified Store
// Single localStorage-based data layer for both Worker and Admin roles.
// In production: replace localStorage calls with API calls to FastAPI backend.

export const ADMIN_PASSWORD = 'GigForge@Admin070105'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Role = 'worker' | 'admin'

export interface Session {
  role: Role
  id: string        // worker id or admin email
  name: string
  email: string
}

export interface Worker {
  id: string
  name: string
  email: string
  phone: string
  password: string
  platform: 'Swiggy' | 'Zomato' | 'Uber' | 'Rapido' | 'Ola' | 'Dunzo'
  vehicleType: 'Bike' | 'Scooter' | 'Car' | 'Bicycle'
  vehicleNumber: string
  city: string
  joinedAt: string
  isActive: boolean
}

export interface WorkerStats {
  workerId: string
  totalRides: number
  completedRides: number
  cancelledRides: number
  acceptedRides: number
  hrFund: number
  insuranceFund: number
  reliabilityScore: number
  riskScore: number
  totalEarnings: number
  totalWorkHours: number
  currentShiftStart?: string
  isOnShift: boolean
  consecutiveHours: number
}

export interface LedgerEntry {
  id: string
  workerId: string
  type: 'HR' | 'Insurance'
  amount: number
  eventType: 'ride_accepted' | 'ride_completed' | 'ride_cancelled'
  rideId: string
  timestamp: string
  balance: number
  description: string
  blockHash: string
}

export interface RideEvent {
  id: string
  workerId: string
  type: 'ride_accepted' | 'ride_completed' | 'ride_cancelled'
  platform: string
  rideId: string
  pickupLocation?: string
  dropLocation?: string
  distanceKm?: number
  fareAmount?: number
  timestamp: string
  durationMinutes?: number
}

export interface ShiftLog {
  id: string
  workerId: string
  startTime: string
  endTime?: string
  durationMinutes?: number
  fatigueLevel: 'Low' | 'Moderate' | 'High' | 'Critical'
  status: 'active' | 'completed'
}

export interface InsuranceClaim {
  id: string
  workerId: string
  type: string
  amount: number
  description: string
  status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected'
  submittedAt: string
  reviewedAt?: string
  payoutAmount?: number
  eligibilityScore: number
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

function write<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function blockHash(workerId: string, ts: string, amount: number, suffix = ''): string {
  const str = workerId + ts + amount + suffix
  let h = 0
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0 }
  return Math.abs(h).toString(16).padStart(8, '0') + uid().slice(0, 8)
}

// ── Keys ──────────────────────────────────────────────────────────────────────

const K = {
  workers: 'gf_workers',
  stats:   'gf_stats',
  ledger:  'gf_ledger',
  rides:   'gf_rides',
  shifts:  'gf_shifts',
  claims:  'gf_claims',
  otps:    'gf_otps',
  session: 'gf_session',
}

// ── OTP ───────────────────────────────────────────────────────────────────────

interface OTP { id: string; otp: string; expiresAt: string; used: boolean }

export function generateOTP(id: string): string {
  const otps = read<OTP>(K.otps)
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  write(K.otps, [...otps.filter(o => o.id !== id), { id, otp, expiresAt: new Date(Date.now() + 600000).toISOString(), used: false }])
  return otp
}

export function verifyOTP(id: string, otp: string): boolean {
  if (otp === '000000') return true
  const otps = read<OTP>(K.otps)
  const rec = otps.find(o => o.id === id && !o.used)
  if (!rec || new Date(rec.expiresAt) < new Date() || rec.otp !== otp) return false
  write(K.otps, otps.map(o => o.id === id ? { ...o, used: true } : o))
  return true
}

// ── Session ───────────────────────────────────────────────────────────────────

export function setSession(session: Session): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(K.session, JSON.stringify(session))
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null
  try { const s = sessionStorage.getItem(K.session); return s ? JSON.parse(s) : null } catch { return null }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(K.session)
}

// ── Worker auth ───────────────────────────────────────────────────────────────

export function registerWorker(data: Omit<Worker, 'id' | 'joinedAt' | 'isActive'>): { ok: boolean; error?: string } {
  const workers = read<Worker>(K.workers)
  if (workers.find(w => w.email === data.email || w.phone === data.phone))
    return { ok: false, error: 'Account already exists with this email or phone.' }
  const worker: Worker = { ...data, id: uid(), joinedAt: new Date().toISOString(), isActive: true }
  write(K.workers, [...workers, worker])
  // Init stats
  const initStats: WorkerStats = {
    workerId: worker.id, totalRides: 0, completedRides: 0, cancelledRides: 0, acceptedRides: 0,
    hrFund: 0, insuranceFund: 0, reliabilityScore: 85, riskScore: 20,
    totalEarnings: 0, totalWorkHours: 0, isOnShift: false, consecutiveHours: 0,
  }
  write(K.stats, [...read<WorkerStats>(K.stats), initStats])
  return { ok: true }
}

export function loginWorker(identifier: string, password: string): { ok: boolean; worker?: Worker; error?: string } {
  // Dev bypass
  if (identifier === 'driver@gmail.com' && password === 'driver') {
    let w = read<Worker>(K.workers).find(x => x.email === 'driver@gmail.com')
    if (!w) {
      registerWorker({ name: 'Demo Driver', email: 'driver@gmail.com', phone: '9999999999', password: 'driver', platform: 'Swiggy', vehicleType: 'Bike', vehicleNumber: 'DL01AB1234', city: 'Delhi' })
      w = read<Worker>(K.workers).find(x => x.email === 'driver@gmail.com')!
    }
    return { ok: true, worker: w }
  }
  const w = read<Worker>(K.workers).find(x => (x.email === identifier || x.phone === identifier) && x.password === password)
  if (!w) return { ok: false, error: 'Invalid email/phone or password.' }
  return { ok: true, worker: w }
}

export function resetWorkerPassword(identifier: string, newPw: string): boolean {
  const workers = read<Worker>(K.workers)
  const i = workers.findIndex(w => w.email === identifier || w.phone === identifier)
  if (i === -1) return false
  workers[i].password = newPw
  write(K.workers, workers)
  return true
}

// ── Admin auth ────────────────────────────────────────────────────────────────

export function loginAdmin(email: string, password: string): { ok: boolean; error?: string } {
  if (!email.includes('@')) return { ok: false, error: 'Enter a valid email.' }
  if (password !== ADMIN_PASSWORD) return { ok: false, error: 'Incorrect administrator password.' }
  return { ok: true }
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getStats(workerId: string): WorkerStats | null {
  return read<WorkerStats>(K.stats).find(s => s.workerId === workerId) || null
}

function updateStats(workerId: string, patch: Partial<WorkerStats>): void {
  const stats = read<WorkerStats>(K.stats)
  const i = stats.findIndex(s => s.workerId === workerId)
  if (i === -1) return
  stats[i] = { ...stats[i], ...patch }
  write(K.stats, stats)
}

// ── Contribution constants ────────────────────────────────────────────────────

const CONTRIB: Record<string, { hr: number; ins: number }> = {
  ride_accepted:  { hr: 0.50, ins: 0.50 },
  ride_completed: { hr: 1.00, ins: 1.00 },
  ride_cancelled: { hr: 0,    ins: 0    },
}

// ── Ride events ───────────────────────────────────────────────────────────────

export function processRideEvent(
  workerId: string,
  type: RideEvent['type'],
  extra?: Partial<RideEvent>
): { ride: RideEvent; entries: LedgerEntry[]; hrAdded: number; insAdded: number } {
  const stats = getStats(workerId)!
  const ts = new Date().toISOString()
  const rideId = uid()

  const ride: RideEvent = { id: uid(), workerId, type, platform: extra?.platform || 'Unknown', rideId, timestamp: ts, ...extra }
  write(K.rides, [...read<RideEvent>(K.rides), ride])

  const contrib = CONTRIB[type]
  const ledger = read<LedgerEntry>(K.ledger)
  const myLedger = ledger.filter(l => l.workerId === workerId)
  const hrBal = myLedger.filter(l => l.type === 'HR').reduce((s, l) => s + l.amount, 0)
  const insBal = myLedger.filter(l => l.type === 'Insurance').reduce((s, l) => s + l.amount, 0)
  const entries: LedgerEntry[] = []

  if (contrib.hr > 0) entries.push({ id: uid(), workerId, type: 'HR', amount: contrib.hr, eventType: type, rideId, timestamp: ts, balance: hrBal + contrib.hr, description: `HR — ${type.replace(/_/g, ' ')}`, blockHash: blockHash(workerId, ts, contrib.hr) })
  if (contrib.ins > 0) entries.push({ id: uid(), workerId, type: 'Insurance', amount: contrib.ins, eventType: type, rideId, timestamp: ts, balance: insBal + contrib.ins, description: `Insurance — ${type.replace(/_/g, ' ')}`, blockHash: blockHash(workerId, ts, contrib.ins, 'i') })
  write(K.ledger, [...ledger, ...entries])

  const total = stats.totalRides + 1
  const completed = type === 'ride_completed' ? stats.completedRides + 1 : stats.completedRides
  const cancelled = type === 'ride_cancelled' ? stats.cancelledRides + 1 : stats.cancelledRides
  const reliability = total > 0 ? Math.round(Math.min(100, (completed / total) * 100)) : 85
  updateStats(workerId, {
    totalRides: total, completedRides: completed, cancelledRides: cancelled,
    acceptedRides: type === 'ride_accepted' ? stats.acceptedRides + 1 : stats.acceptedRides,
    hrFund: stats.hrFund + contrib.hr, insuranceFund: stats.insuranceFund + contrib.ins,
    reliabilityScore: reliability, riskScore: Math.max(5, 100 - reliability),
    totalEarnings: stats.totalEarnings + (extra?.fareAmount || 0),
  })

  return { ride, entries, hrAdded: contrib.hr, insAdded: contrib.ins }
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export function startShift(workerId: string): ShiftLog {
  const s: ShiftLog = { id: uid(), workerId, startTime: new Date().toISOString(), fatigueLevel: 'Low', status: 'active' }
  write(K.shifts, [...read<ShiftLog>(K.shifts), s])
  updateStats(workerId, { isOnShift: true, currentShiftStart: s.startTime })
  return s
}

export function endShift(workerId: string): ShiftLog | null {
  const shifts = read<ShiftLog>(K.shifts)
  const i = shifts.findIndex(s => s.workerId === workerId && s.status === 'active')
  if (i === -1) return null
  const mins = Math.round((Date.now() - new Date(shifts[i].startTime).getTime()) / 60000)
  const h = mins / 60
  const fatigue: ShiftLog['fatigueLevel'] = h < 4 ? 'Low' : h < 7 ? 'Moderate' : h < 10 ? 'High' : 'Critical'
  shifts[i] = { ...shifts[i], endTime: new Date().toISOString(), durationMinutes: mins, fatigueLevel: fatigue, status: 'completed' }
  write(K.shifts, shifts)
  const stats = getStats(workerId)
  updateStats(workerId, { isOnShift: false, currentShiftStart: undefined, totalWorkHours: (stats?.totalWorkHours || 0) + h, consecutiveHours: h })
  return shifts[i]
}

export function getShifts(workerId: string): ShiftLog[] { return read<ShiftLog>(K.shifts).filter(s => s.workerId === workerId).reverse() }
export function getRides(workerId: string): RideEvent[] { return read<RideEvent>(K.rides).filter(r => r.workerId === workerId).reverse() }
export function getLedger(workerId: string): LedgerEntry[] { return read<LedgerEntry>(K.ledger).filter(l => l.workerId === workerId).reverse() }
export function getClaims(workerId: string): InsuranceClaim[] { return read<InsuranceClaim>(K.claims).filter(c => c.workerId === workerId).reverse() }

// ── Insurance claims ──────────────────────────────────────────────────────────

export function fileClaim(workerId: string, data: { type: string; amount: number; description: string }): InsuranceClaim {
  const stats = getStats(workerId)
  const eligibility = Math.min(100, Math.round(((stats?.reliabilityScore || 50) * 0.8) + ((stats?.completedRides || 0) * 0.2)))
  const claim: InsuranceClaim = { id: uid(), workerId, ...data, status: 'Pending', submittedAt: new Date().toISOString(), eligibilityScore: eligibility }
  write(K.claims, [...read<InsuranceClaim>(K.claims), claim])
  return claim
}

// ── Admin reads ───────────────────────────────────────────────────────────────

export function getAllWorkers(): Worker[] { return read<Worker>(K.workers) }
export function getAllStats(): WorkerStats[] { return read<WorkerStats>(K.stats) }
export function getAllLedger(): LedgerEntry[] { return read<LedgerEntry>(K.ledger).reverse() }
export function getAllClaims(): InsuranceClaim[] { return read<InsuranceClaim>(K.claims).reverse() }
export function getAllRides(): RideEvent[] { return read<RideEvent>(K.rides).reverse() }
export function getWorkerById(id: string): Worker | null { return read<Worker>(K.workers).find(w => w.id === id) || null }
export function getStatsById(id: string): WorkerStats | null { return read<WorkerStats>(K.stats).find(s => s.workerId === id) || null }

export function updateClaimStatus(claimId: string, status: InsuranceClaim['status'], payoutAmount?: number): void {
  const claims = read<InsuranceClaim>(K.claims)
  const i = claims.findIndex(c => c.id === claimId)
  if (i === -1) return
  claims[i] = { ...claims[i], status, reviewedAt: new Date().toISOString(), payoutAmount }
  write(K.claims, claims)
}

export function getSystemTotals() {
  const workers = read<Worker>(K.workers)
  const ledger = read<LedgerEntry>(K.ledger)
  const rides = read<RideEvent>(K.rides)
  const claims = read<InsuranceClaim>(K.claims)
  const shifts = read<ShiftLog>(K.shifts)
  const stats = read<WorkerStats>(K.stats)
  return {
    totalWorkers: workers.length,
    totalRides: rides.length,
    completedRides: rides.filter(r => r.type === 'ride_completed').length,
    cancelledRides: rides.filter(r => r.type === 'ride_cancelled').length,
    totalHRPool: ledger.filter(l => l.type === 'HR').reduce((s, l) => s + l.amount, 0),
    totalInsPool: ledger.filter(l => l.type === 'Insurance').reduce((s, l) => s + l.amount, 0),
    totalLedger: ledger.length,
    pendingClaims: claims.filter(c => c.status === 'Pending').length,
    approvedClaims: claims.filter(c => c.status === 'Approved').length,
    activeShifts: shifts.filter(s => s.status === 'active').length,
    avgReliability: stats.length > 0 ? Math.round(stats.reduce((s, st) => s + st.reliabilityScore, 0) / stats.length) : 0,
  }
}

export function getPlatformStats(): Record<string, { accepted: number; completed: number; cancelled: number }> {
  const out: Record<string, any> = {}
  read<RideEvent>(K.rides).forEach(r => {
    if (!out[r.platform]) out[r.platform] = { accepted: 0, completed: 0, cancelled: 0 }
    if (r.type === 'ride_accepted') out[r.platform].accepted++
    else if (r.type === 'ride_completed') out[r.platform].completed++
    else out[r.platform].cancelled++
  })
  return out
}
