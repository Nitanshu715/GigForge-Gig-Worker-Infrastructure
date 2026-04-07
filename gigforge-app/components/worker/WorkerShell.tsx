'use client'
import { useState, useEffect, useCallback } from 'react'
import { clearSession, getStats, getRides, getLedger, getShifts, getClaims, processRideEvent, startShift, endShift, fileClaim } from '@/lib/store'
import type { Session, WorkerStats, RideEvent, LedgerEntry, ShiftLog, InsuranceClaim } from '@/lib/store'
import { StatCard, Card, PageHeader, Btn, Badge, Table, Modal, Field, Input, Select, Textarea, ScoreBar } from '../ui'

type View = 'dashboard' | 'rides' | 'hours' | 'contributions' | 'insurance' | 'ledger' | 'activity' | 'profile'

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id:'dashboard',     label:'Dashboard',     icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg> },
  { id:'rides',         label:'Ride controls', icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="5.5" cy="17.5" r="2.5" stroke="currentColor" strokeWidth="1.8"/><circle cx="18.5" cy="17.5" r="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M8 17.5h7M15 17.5V11l-3-5H7L3.5 12H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M15 11h4l2 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id:'hours',         label:'Working hours', icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id:'contributions', label:'Contributions', icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id:'insurance',     label:'Insurance',     icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id:'ledger',        label:'Ledger',        icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id:'activity',      label:'Activity log',  icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id:'profile',       label:'Profile',       icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/></svg> },
]

const ec: Record<string,any> = { ride_accepted:'blue', ride_completed:'green', ride_cancelled:'red' }
const el: Record<string,string> = { ride_accepted:'Accepted', ride_completed:'Completed', ride_cancelled:'Cancelled' }

export default function WorkerShell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [view, setView] = useState<View>('dashboard')
  const [dark, setDark] = useState(false)
  const [key, setKey] = useState(0)
  const [toast, setToast] = useState<{ msg:string; color:string } | null>(null)

  const showToast = (msg: string, color = 'var(--green)') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }
  const refresh = () => setKey(k => k + 1)
  const toggleDark = () => { setDark(d => { document.documentElement.classList.toggle('dark', !d); return !d }) }

  const sidebar = (
    <aside style={{ width:220, flexShrink:0, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>
      <div style={{ padding:'18px 18px 14px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:28, height:28, background:'var(--brand)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color:'var(--text)', letterSpacing:'-0.3px' }}>GigForge</div>
            <div style={{ fontSize:10, color:'var(--brand)', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>Driver</div>
          </div>
        </div>
      </div>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--brand-dim)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ fontWeight:700, fontSize:13, color:'var(--brand)' }}>{session.name.charAt(0).toUpperCase()}</span>
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session.name}</div>
            <div style={{ fontSize:11, color:'var(--text-3)' }}>Driver account</div>
          </div>
        </div>
      </div>
      <nav style={{ padding:'10px 10px', flex:1 }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setView(item.id)} style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'8px 10px', borderRadius:8, border:'none', cursor:'pointer', background:view===item.id?'var(--brand)':'transparent', color:view===item.id?'#fff':'var(--text-2)', fontSize:13, fontWeight:view===item.id?600:400, textAlign:'left', marginBottom:1, transition:'all 0.1s' }}>
            {item.icon}{item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding:'10px', borderTop:'1px solid var(--border)' }}>
        <button onClick={toggleDark} style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'7px 10px', borderRadius:8, border:'none', cursor:'pointer', background:'transparent', color:'var(--text-2)', fontSize:13, textAlign:'left', marginBottom:2 }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
        <button onClick={() => { clearSession(); onLogout() }} style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'7px 10px', borderRadius:8, border:'none', cursor:'pointer', background:'transparent', color:'var(--red)', fontSize:13, textAlign:'left' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      {toast && (
        <div className="animate-toast" style={{ position:'fixed', bottom:24, right:24, background:'var(--surface)', border:`1px solid var(--border)`, borderLeft:`4px solid ${toast.color}`, borderRadius:10, padding:'13px 18px', fontSize:13, color:'var(--text)', zIndex:9999, maxWidth:360, boxShadow:'0 4px 20px rgba(0,0,0,0.12)' }}>
          {toast.msg}
        </div>
      )}
      {sidebar}
      <main style={{ flex:1, overflow:'auto', padding:'28px 32px' }}>
        {view === 'dashboard'     && <WorkerDashboard session={session} key={key} />}
        {view === 'rides'         && <WorkerRides session={session} onUpdate={refresh} onToast={showToast} key={key} />}
        {view === 'hours'         && <WorkerHours session={session} onUpdate={refresh} onToast={showToast} key={key} />}
        {view === 'contributions' && <WorkerContributions session={session} key={key} />}
        {view === 'insurance'     && <WorkerInsurance session={session} onUpdate={refresh} key={key} />}
        {view === 'ledger'        && <WorkerLedger session={session} key={key} />}
        {view === 'activity'      && <WorkerActivity session={session} key={key} />}
        {view === 'profile'       && <WorkerProfile session={session} key={key} />}
      </main>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function WorkerDashboard({ session }: { session: Session }) {
  const [stats, setStats] = useState<WorkerStats | null>(null)
  const [rides, setRides] = useState<RideEvent[]>([])
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    setStats(getStats(session.id))
    setRides(getRides(session.id).slice(0, 6))
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [session.id])

  if (!stats) return <div style={{ color:'var(--text-2)', padding:24 }}>Loading…</div>

  return (
    <div className="animate-up">
      <PageHeader title={`Namaste, ${session.name.split(' ')[0]}`} sub={`${now.toLocaleString('en-IN', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit', second:'2-digit' })}`}>
        {stats.isOnShift && <Badge color="green">On shift</Badge>}
      </PageHeader>
      <div className="stagger" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(170px,1fr))', gap:14, marginBottom:24 }}>
        <StatCard label="Total rides" value={stats.totalRides} sub={`${stats.completedRides} completed`} accent="var(--brand)" />
        <StatCard label="HR fund" value={`₹${stats.hrFund.toFixed(2)}`} accent="var(--blue)" />
        <StatCard label="Insurance pool" value={`₹${stats.insuranceFund.toFixed(2)}`} accent="var(--green)" />
        <StatCard label="Total fund" value={`₹${(stats.hrFund + stats.insuranceFund).toFixed(2)}`} accent="var(--amber)" />
        <StatCard label="Work hours" value={stats.totalWorkHours.toFixed(1)+'h'} accent="#7C3AED" />
        <StatCard label="Reliability" value={`${stats.reliabilityScore}%`} accent={stats.reliabilityScore >= 80 ? 'var(--green)' : 'var(--amber)'} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Performance</div>
          <div style={{ marginBottom:14 }}><div style={{ fontSize:13, color:'var(--text-2)', marginBottom:6 }}>Reliability score</div><ScoreBar value={stats.reliabilityScore} /></div>
          <div><div style={{ fontSize:13, color:'var(--text-2)', marginBottom:6 }}>Safety (inverse risk)</div><ScoreBar value={100 - stats.riskScore} /></div>
          <div style={{ marginTop:14, padding:'10px', background:'var(--bg)', borderRadius:8, fontSize:12, color:'var(--text-2)' }}>
            Cancellation rate <strong>{stats.totalRides > 0 ? Math.round((stats.cancelledRides / stats.totalRides) * 100) : 0}%</strong>
          </div>
        </Card>
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Ride breakdown</div>
          {[{ label:'Accepted', val:stats.acceptedRides, c:'var(--blue)' },{ label:'Completed', val:stats.completedRides, c:'var(--green)' },{ label:'Cancelled', val:stats.cancelledRides, c:'var(--red)' }].map(r => (
            <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:r.c }} />
                <span style={{ fontSize:13, color:'var(--text)' }}>{r.label}</span>
              </div>
              <span className="tabular" style={{ fontWeight:700, fontSize:18, color:r.c }}>{r.val}</span>
            </div>
          ))}
        </Card>
      </div>
      <Card>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Recent activity</div>
        {rides.length === 0
          ? <div style={{ textAlign:'center', padding:32, color:'var(--text-3)', fontSize:13 }}>No rides yet. Go to Ride controls to start.</div>
          : rides.map((r, i) => (
            <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom: i < rides.length-1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize:13, color:'var(--text)' }}>{r.platform} · {el[r.type]}</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:11, color:'var(--text-3)' }}>{new Date(r.timestamp).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                <Badge color={ec[r.type]}>{el[r.type]}</Badge>
              </div>
            </div>
          ))}
      </Card>
    </div>
  )
}

// ── Rides ─────────────────────────────────────────────────────────────────────

function WorkerRides({ session, onUpdate, onToast }: { session:Session; onUpdate:()=>void; onToast:(m:string,c:string)=>void }) {
  const [stats, setStats] = useState<WorkerStats | null>(null)
  const [loading, setLoading] = useState<string|null>(null)
  const [modal, setModal] = useState<'accept'|'complete'|null>(null)
  const [rf, setRf] = useState({ platform:'Swiggy', distanceKm:'5', fareAmount:'80', pickupLocation:'', dropLocation:'' })
  const [last, setLast] = useState<any>(null)

  useEffect(() => { setStats(getStats(session.id)) }, [session.id])

  const trigger = (type: RideEvent['type'], extra?: any) => {
    setLoading(type)
    setTimeout(() => {
      const { hrAdded, insAdded } = processRideEvent(session.id, type, extra)
      setStats(getStats(session.id))
      setLast({ type, hr: hrAdded, ins: insAdded })
      const color = type==='ride_completed'?'var(--green)':type==='ride_accepted'?'var(--blue)':'var(--red)'
      onToast(`${el[type]} · HR +₹${hrAdded.toFixed(2)} · Ins +₹${insAdded.toFixed(2)}`, color)
      onUpdate()
      setLoading(null)
    }, 500)
  }

  const doAccept = () => { trigger('ride_accepted', { platform:rf.platform, distanceKm:+rf.distanceKm||5, fareAmount:+rf.fareAmount||80, pickupLocation:rf.pickupLocation||'Auto-generated', dropLocation:rf.dropLocation||'Auto-generated' }); setModal(null) }
  const doComplete = () => { trigger('ride_completed', { platform:rf.platform, distanceKm:+rf.distanceKm||5, fareAmount:+rf.fareAmount||80, pickupLocation:rf.pickupLocation||'Auto-generated', dropLocation:rf.dropLocation||'Auto-generated' }); setModal(null) }
  const F = (k:string) => (v:string) => setRf(x => ({ ...x, [k]:v }))
  const PLAT = ['Swiggy','Zomato','Uber','Rapido','Ola','Dunzo'].map(p=>({value:p,label:p}))

  return (
    <div className="animate-up">
      <PageHeader title="Ride controls" sub="Each event generates micro HR and insurance contributions recorded in an immutable ledger." />
      <Card style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:14 }}>Contribution rates</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[{ev:'Accept ride',hr:'₹0.50',ins:'₹0.50',c:'var(--blue)'},{ev:'Complete ride',hr:'₹1.00',ins:'₹1.00',c:'var(--green)'},{ev:'Cancel ride',hr:'₹0.00',ins:'₹0.00',c:'var(--red)'}].map(r=>(
            <div key={r.ev} style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:9, borderLeft:`3px solid ${r.c}` }}>
              <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', marginBottom:8 }}>{r.ev}</div>
              <div style={{ display:'flex', gap:8 }}>
                <Badge color="blue">HR {r.hr}</Badge>
                <Badge color="green">Ins {r.ins}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {stats && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
          <StatCard label="HR fund" value={`₹${stats.hrFund.toFixed(2)}`} accent="var(--blue)" />
          <StatCard label="Insurance" value={`₹${stats.insuranceFund.toFixed(2)}`} accent="var(--green)" />
          <StatCard label="Reliability" value={`${stats.reliabilityScore}%`} accent="var(--amber)" />
          <StatCard label="Total rides" value={stats.totalRides} accent="var(--brand)" />
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
        {[
          { type:'ride_accepted' as const, label:'Accept ride', desc:'Earn ₹0.50 HR + ₹0.50 ins', icon:<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>, bg:'var(--blue-bg)', color:'var(--blue)', action:() => setModal('accept') },
          { type:'ride_completed' as const, label:'Complete ride', desc:'Earn ₹1.00 HR + ₹1.00 ins', icon:<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>, bg:'var(--green-bg)', color:'var(--green)', action:() => setModal('complete') },
          { type:'ride_cancelled' as const, label:'Cancel ride', desc:'Affects reliability score', icon:<svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="var(--red)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>, bg:'var(--red-bg)', color:'var(--red)', action:() => trigger('ride_cancelled', { platform:rf.platform }) },
        ].map(item => (
          <Card key={item.type} style={{ textAlign:'center' as const }}>
            <div style={{ width:48, height:48, background:item.bg, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>{item.icon}</div>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:4 }}>{item.label}</div>
            <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>{item.desc}</div>
            <button onClick={item.action} disabled={!!loading} style={{ width:'100%', padding:'10px', background:item.bg, color:item.color, border:`1px solid ${item.color}30`, borderRadius:8, fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer', opacity:loading?0.6:1, fontFamily:'inherit' }}>
              {loading === item.type ? 'Processing…' : item.label}
            </button>
          </Card>
        ))}
      </div>
      {last && (
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:12 }}>Last event processed</div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Badge color={ec[last.type]}>{el[last.type]}</Badge>
            <span style={{ fontSize:13, color:'var(--text-2)' }}>HR <strong>+₹{last.hr.toFixed(2)}</strong> · Insurance <strong>+₹{last.ins.toFixed(2)}</strong></span>
          </div>
          <div style={{ marginTop:10, padding:'9px 12px', background:'var(--bg)', borderRadius:8, fontSize:12, color:'var(--text-3)', fontFamily:'monospace' }}>
            Worker action → Event published → Contribution service → Ledger write (append-only) → Cache updated
          </div>
        </Card>
      )}
      <Modal open={modal==='accept'} onClose={() => setModal(null)} title="Accept ride — enter details">
        <Field label="Platform"><Select value={rf.platform} onChange={F('platform')} options={PLAT} /></Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Distance (km)"><Input value={rf.distanceKm} onChange={F('distanceKm')} placeholder="5" /></Field>
          <Field label="Fare (₹)"><Input value={rf.fareAmount} onChange={F('fareAmount')} placeholder="80" /></Field>
        </div>
        <Field label="Pickup (optional)"><Input value={rf.pickupLocation} onChange={F('pickupLocation')} placeholder="Auto-generated" /></Field>
        <Field label="Drop (optional)"><Input value={rf.dropLocation} onChange={F('dropLocation')} placeholder="Auto-generated" /></Field>
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <Btn onClick={doAccept} style={{ flex:1 }}>Confirm (+₹0.50 HR, +₹0.50 Ins)</Btn>
          <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
        </div>
      </Modal>
      <Modal open={modal==='complete'} onClose={() => setModal(null)} title="Complete ride — enter details">
        <Field label="Platform"><Select value={rf.platform} onChange={F('platform')} options={PLAT} /></Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Distance (km)"><Input value={rf.distanceKm} onChange={F('distanceKm')} placeholder="5" /></Field>
          <Field label="Fare (₹)"><Input value={rf.fareAmount} onChange={F('fareAmount')} placeholder="80" /></Field>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <Btn onClick={doComplete} style={{ flex:1, background:'var(--green)' }}>Confirm (+₹1.00 HR, +₹1.00 Ins)</Btn>
          <Btn variant="ghost" onClick={() => setModal(null)}>Cancel</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ── Hours ─────────────────────────────────────────────────────────────────────

function WorkerHours({ session, onUpdate, onToast }: { session:Session; onUpdate:()=>void; onToast:(m:string,c:string)=>void }) {
  const [stats, setStats] = useState<WorkerStats|null>(null)
  const [shifts, setShifts] = useState<ShiftLog[]>([])
  const [elapsed, setElapsed] = useState(0)

  const load = () => { setStats(getStats(session.id)); setShifts(getShifts(session.id)) }
  useEffect(() => { load() }, [session.id])
  useEffect(() => {
    const t = setInterval(() => {
      const s = getStats(session.id)
      if (s?.isOnShift && s.currentShiftStart) setElapsed(Math.floor((Date.now() - new Date(s.currentShiftStart).getTime()) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [session.id])

  const fmt = (s:number) => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  const fmtM = (m?:number) => !m ? '—' : Math.floor(m/60) > 0 ? `${Math.floor(m/60)}h ${m%60}m` : `${m}m`
  const fc: Record<string,any> = { Low:'green', Moderate:'amber', High:'red', Critical:'red' }

  const rows = shifts.map(s => [
    <span className="mono" style={{ fontSize:11, color:'var(--text-3)' }}>{s.id.slice(-6).toUpperCase()}</span>,
    new Date(s.startTime).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),
    s.endTime ? new Date(s.endTime).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : <Badge color="green">Active</Badge>,
    fmtM(s.durationMinutes),
    <Badge color={fc[s.fatigueLevel]}>{s.fatigueLevel}</Badge>,
  ])

  return (
    <div className="animate-up">
      <PageHeader title="Working hours" sub="Track shifts and monitor fatigue levels to stay safe on the road." />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        <StatCard label="Total hours" value={(stats?.totalWorkHours||0).toFixed(1)+'h'} accent="var(--brand)" />
        <StatCard label="Total shifts" value={shifts.length} accent="var(--blue)" />
        <StatCard label="On shift" value={stats?.isOnShift ? 'Yes' : 'No'} accent={stats?.isOnShift ? 'var(--green)' : 'var(--text-3)'} />
        <StatCard label="Last fatigue" value={shifts[0]?.fatigueLevel || '—'} accent="var(--amber)" />
      </div>
      <Card style={{ marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:4 }}>{stats?.isOnShift ? 'Shift in progress' : 'No active shift'}</div>
            {stats?.isOnShift ? (
              <div className="mono" style={{ fontSize:22, fontWeight:700, color:'var(--brand)' }}>{fmt(elapsed)}</div>
            ) : (
              <div style={{ fontSize:13, color:'var(--text-3)' }}>Start a shift to begin tracking your working hours and fatigue level.</div>
            )}
          </div>
          {!stats?.isOnShift
            ? <Btn size="lg" onClick={() => { startShift(session.id); load(); onUpdate(); onToast('Shift started', 'var(--green)') }}>Start shift</Btn>
            : <Btn size="lg" variant="danger" onClick={() => { endShift(session.id); load(); setElapsed(0); onUpdate(); onToast('Shift ended', 'var(--blue)') }}>End shift</Btn>
          }
        </div>
      </Card>
      <Card>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Shift history</div>
        <Table headers={['Shift ID','Start','End','Duration','Fatigue']} rows={rows} empty="No shifts yet." />
      </Card>
    </div>
  )
}

// ── Contributions ─────────────────────────────────────────────────────────────

function WorkerContributions({ session }: { session:Session }) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [stats, setStats] = useState<WorkerStats|null>(null)
  const [filter, setFilter] = useState<'all'|'HR'|'Insurance'>('all')
  useEffect(() => { setLedger(getLedger(session.id)); setStats(getStats(session.id)) }, [session.id])
  const exportCSV = () => {
    const rows = [['Type','Amount','Event','Description','Balance','Timestamp']].concat(ledger.map(l => [l.type,l.amount.toString(),l.eventType,l.description,l.balance.toString(),l.timestamp]))
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n')); a.download='gigforge_contributions.csv'; a.click()
  }
  const filtered = filter==='all' ? ledger : ledger.filter(l => l.type===filter)
  const rows = filtered.map(e => [<Badge color={e.type==='HR'?'blue':'green'}>{e.type}</Badge>, <strong>₹{e.amount.toFixed(2)}</strong>, <Badge color={ec[e.eventType]}>{el[e.eventType]}</Badge>, e.description, <span className="tabular">₹{e.balance.toFixed(2)}</span>, new Date(e.timestamp).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})])
  return (
    <div className="animate-up">
      <PageHeader title="Contributions" sub="Append-only ledger of every rupee contributed to your HR and insurance funds.">
        <div style={{ display:'flex', gap:6 }}>
          {(['all','HR','Insurance'] as const).map(f => <Btn key={f} size="sm" variant={filter===f?'primary':'ghost'} onClick={() => setFilter(f)}>{f==='all'?'All':f}</Btn>)}
          <Btn size="sm" variant="secondary" onClick={exportCSV}>Export CSV</Btn>
        </div>
      </PageHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <StatCard label="HR fund" value={`₹${(stats?.hrFund||0).toFixed(2)}`} accent="var(--blue)" />
        <StatCard label="Insurance fund" value={`₹${(stats?.insuranceFund||0).toFixed(2)}`} accent="var(--green)" />
        <StatCard label="Total fund" value={`₹${((stats?.hrFund||0)+(stats?.insuranceFund||0)).toFixed(2)}`} accent="var(--brand)" />
        <StatCard label="Entries" value={ledger.length} accent="var(--amber)" />
      </div>
      <Card><Table headers={['Type','Amount','Event','Description','Balance','Timestamp']} rows={rows} empty="No contributions yet. Accept or complete rides to start." /></Card>
    </div>
  )
}

// ── Insurance ─────────────────────────────────────────────────────────────────

function WorkerInsurance({ session, onUpdate }: { session:Session; onUpdate:()=>void }) {
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [stats, setStats] = useState<WorkerStats|null>(null)
  const [modal, setModal] = useState(false)
  const [view, setView] = useState<InsuranceClaim|null>(null)
  const [form, setForm] = useState({ type:'Accident', amount:'', description:'' })
  const [err, setErr] = useState('')

  const load = () => { setClaims(getClaims(session.id)); setStats(getStats(session.id)) }
  useEffect(() => { load() }, [session.id])

  const eligibility = stats ? Math.min(100, Math.round(stats.reliabilityScore * 0.8 + stats.completedRides * 0.2)) : 0
  const isEligible = eligibility >= 40

  const submit = () => {
    setErr('')
    if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) return setErr('Enter a valid amount.')
    if (!form.description.trim()) return setErr('Description is required.')
    fileClaim(session.id, { type:form.type, amount:+form.amount, description:form.description })
    setForm({ type:'Accident', amount:'', description:'' })
    setModal(false); load(); onUpdate()
  }

  const sc: Record<string,any> = { Pending:'amber', 'Under Review':'blue', Approved:'green', Rejected:'red' }
  const rows = claims.map(c => [<span className="mono" style={{fontSize:11}}>{c.id.slice(-8).toUpperCase()}</span>, c.type, <strong>₹{c.amount.toLocaleString('en-IN')}</strong>, <Badge color={sc[c.status]}>{c.status}</Badge>, `${c.eligibilityScore}%`, new Date(c.submittedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'}), <Btn size="sm" variant="ghost" onClick={() => setView(c)}>View</Btn>])

  return (
    <div className="animate-up">
      <PageHeader title="Insurance" sub="Your coverage, claims, and insurance fund."><Btn onClick={() => setModal(true)} disabled={!isEligible}>File claim</Btn></PageHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <StatCard label="Insurance pool" value={`₹${(stats?.insuranceFund||0).toFixed(2)}`} accent="var(--green)" />
        <StatCard label="Eligibility" value={`${eligibility}%`} sub={isEligible?'Eligible':'Build more rides'} accent={isEligible?'var(--green)':'var(--red)'} />
        <StatCard label="Total claims" value={claims.length} accent="var(--blue)" />
        <StatCard label="Approved" value={claims.filter(c=>c.status==='Approved').length} accent="var(--brand)" />
      </div>
      {!isEligible && <Card style={{ marginBottom:16, borderColor:'var(--amber)' }}><div style={{ fontSize:13, color:'var(--amber)' }}>Your eligibility score ({eligibility}%) is below 40%. Complete more rides to become eligible for claims.</div></Card>}
      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:12 }}>Coverage available</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {[['Accident','₹2,00,000'],['Medical','₹50,000'],['Vehicle Damage','₹25,000'],['Third Party','₹1,00,000'],['Death Benefit','₹5,00,000']].map(([t,l]) => (
            <div key={t} style={{ padding:'12px', background:'var(--bg)', borderRadius:8 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', marginBottom:4 }}>{t}</div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--green)' }}>{l}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card><Table headers={['ID','Type','Amount','Status','Eligibility','Filed','Actions']} rows={rows} empty="No claims yet." /></Card>
      <Modal open={modal} onClose={() => setModal(false)} title="File insurance claim">
        {err && <div style={{ background:'var(--red-bg)', color:'var(--red)', padding:'10px 14px', borderRadius:8, fontSize:13, marginBottom:14 }}>{err}</div>}
        <Field label="Claim type"><Select value={form.type} onChange={v => setForm(x=>({...x,type:v}))} options={['Accident','Medical','Vehicle Damage','Third Party','Death Benefit'].map(t=>({value:t,label:t}))} /></Field>
        <Field label="Amount (₹)"><Input value={form.amount} onChange={v => setForm(x=>({...x,amount:v}))} placeholder="Enter claim amount" type="number" /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={v => setForm(x=>({...x,description:v}))} placeholder="Describe the incident…" rows={4} /></Field>
        <div style={{ display:'flex', gap:10, marginTop:8 }}><Btn onClick={submit} style={{ flex:1 }}>Submit claim</Btn><Btn variant="ghost" onClick={() => setModal(false)}>Cancel</Btn></div>
      </Modal>
      {view && <Modal open={!!view} onClose={() => setView(null)} title="Claim details">
        {[['Claim ID',view.id.slice(-8).toUpperCase()],['Type',view.type],['Amount',`₹${view.amount.toLocaleString('en-IN')}`],['Status',<Badge color={sc[view.status]}>{view.status}</Badge>],['Eligibility',`${view.eligibilityScore}%`],['Filed',new Date(view.submittedAt).toLocaleString('en-IN')],['Description',view.description]].map(([l,v]:any) => (
          <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{l}</span>
            <span style={{ fontSize:13, color:'var(--text)', textAlign:'right', maxWidth:'60%' }}>{v}</span>
          </div>
        ))}
        {view.payoutAmount && <div style={{ marginTop:12, padding:'10px', background:'var(--green-bg)', borderRadius:8, fontSize:13, color:'var(--green)', fontWeight:600 }}>Payout: ₹{view.payoutAmount.toLocaleString('en-IN')}</div>}
      </Modal>}
    </div>
  )
}

// ── Ledger ────────────────────────────────────────────────────────────────────

function WorkerLedger({ session }: { session:Session }) {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  useEffect(() => { setLedger(getLedger(session.id)) }, [session.id])
  const exportCSV = () => {
    const rows = [['Entry','BlockHash','Type','Amount','Event','Balance','Timestamp']].concat(ledger.map((l,i)=>[(ledger.length-i).toString(),l.blockHash,l.type,l.amount.toString(),l.eventType,l.balance.toString(),l.timestamp]))
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n')); a.download='gigforge_ledger.csv'; a.click()
  }
  const rows = ledger.map((e,i) => [<span className="mono" style={{fontSize:11,color:'var(--text-3)'}}>{(ledger.length-i).toString().padStart(4,'0')}</span>, <span className="mono" style={{fontSize:11,color:'var(--text-2)'}}>{e.blockHash.slice(0,16)}</span>, <Badge color={e.type==='HR'?'blue':'green'}>{e.type}</Badge>, <strong>+₹{e.amount.toFixed(2)}</strong>, <Badge color={ec[e.eventType]}>{el[e.eventType]}</Badge>, <span className="tabular">₹{e.balance.toFixed(2)}</span>, new Date(e.timestamp).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})])
  return (
    <div className="animate-up">
      <PageHeader title="Ledger" sub="Append-only financial record. Every entry is immutable and hash-linked."><Btn size="sm" variant="secondary" onClick={exportCSV}>Export CSV</Btn></PageHeader>
      <Card style={{ marginBottom:16, padding:'12px 18px' }}><div style={{ fontSize:12, color:'var(--text-2)' }}>Append-only ledger — no entry is ever modified or deleted. Each block hash is derived from worker ID + timestamp + amount, making the ledger tamper-evident. In Part 2 (production), Kafka enables full event replay to reconstruct system state at any point in time.</div></Card>
      <Card><Table headers={['Entry #','Block hash','Type','Amount','Event','Balance','Timestamp']} rows={rows} empty="No ledger entries yet." /></Card>
    </div>
  )
}

// ── Activity ──────────────────────────────────────────────────────────────────

function WorkerActivity({ session }: { session:Session }) {
  const [rides, setRides] = useState<RideEvent[]>([])
  useEffect(() => { setRides(getRides(session.id)) }, [session.id])
  const rows = rides.map(r => [<span className="mono" style={{fontSize:11,color:'var(--text-3)'}}>{r.id.slice(-8).toUpperCase()}</span>, <Badge color={ec[r.type]}>{el[r.type]}</Badge>, r.platform, r.pickupLocation||'—', r.dropLocation||'—', r.distanceKm?`${r.distanceKm} km`:'—', r.fareAmount?`₹${r.fareAmount}`:'—', new Date(r.timestamp).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})])
  return (
    <div className="animate-up">
      <PageHeader title="Activity log" sub="Full history of all ride events." />
      <Card><Table headers={['Ride ID','Event','Platform','Pickup','Drop','Distance','Fare','Timestamp']} rows={rows} empty="No activity yet." /></Card>
    </div>
  )
}

// ── Profile ───────────────────────────────────────────────────────────────────

function WorkerProfile({ session }: { session:Session }) {
  const [workers, setWorkers] = useState<any[]>([])
  const [stats, setStats] = useState<WorkerStats|null>(null)
  useEffect(() => {
    const { getAllWorkers } = require('@/lib/store')
    const ws = getAllWorkers()
    const w = ws.find((x:any) => x.id === session.id)
    setWorkers(w ? [w] : [])
    setStats(getStats(session.id))
  }, [session.id])
  const w = workers[0]
  return (
    <div className="animate-up">
      <PageHeader title="Profile" sub="Your GigForge driver account." />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Account info</div>
          {w && [['Name',w.name],['Email',w.email],['Phone',w.phone],['Platform',w.platform],['Vehicle',w.vehicleType],['Number',w.vehicleNumber],['City',w.city],['Joined',new Date(w.joinedAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})]].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{l}</span>
              <span style={{ fontSize:13, color:'var(--text)', fontWeight:500 }}>{v}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Performance</div>
          {stats && [['Total rides',stats.totalRides],['Completed',stats.completedRides],['Cancelled',stats.cancelledRides],['HR fund',`₹${stats.hrFund.toFixed(2)}`],['Insurance',`₹${stats.insuranceFund.toFixed(2)}`],['Reliability',`${stats.reliabilityScore}%`],['Risk score',stats.riskScore],['Work hours',`${stats.totalWorkHours.toFixed(1)}h`]].map(([l,v]:any) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{l}</span>
              <span className="tabular" style={{ fontSize:14, color:'var(--text)', fontWeight:700 }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
