'use client'
import { useState, useEffect } from 'react'
import { clearSession, getSystemTotals, getPlatformStats, getAllWorkers, getAllStats, getAllLedger, getAllClaims, getAllRides, getWorkerById, getStatsById, updateClaimStatus } from '@/lib/store'
import type { Session, WorkerStats, InsuranceClaim, LedgerEntry } from '@/lib/store'
import { StatCard, Card, PageHeader, Btn, Badge, Table, Modal, Field, ScoreBar, Textarea } from '../ui'

type View = 'overview' | 'workers' | 'claims' | 'ledger' | 'rides' | 'analytics' | 'architecture'

const NAV: { id: View; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id:'overview',     label:'Overview',        icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/></svg> },
  { id:'workers',      label:'Workers',         icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id:'claims',       label:'Claims',          icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id:'ledger',       label:'Platform ledger', icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id:'rides',        label:'Ride events',     icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id:'analytics',    label:'Analytics',       icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg> },
  { id:'architecture', label:'Part 2 — Paid',   icon:<svg width="15" height="15" fill="none" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>, badge:'PRO' },
]

const ec: Record<string,any> = { ride_accepted:'blue', ride_completed:'green', ride_cancelled:'red' }
const el: Record<string,string> = { ride_accepted:'Accepted', ride_completed:'Completed', ride_cancelled:'Cancelled' }
const sc: Record<string,any> = { Pending:'amber', 'Under Review':'blue', Approved:'green', Rejected:'red' }

export default function AdminShell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [view, setView] = useState<View>('overview')
  const [dark, setDark] = useState(false)
  const [key, setKey] = useState(0)

  const toggleDark = () => { setDark(d => { document.documentElement.classList.toggle('dark', !d); return !d }) }
  const refresh = () => setKey(k => k + 1)

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <aside style={{ width:220, flexShrink:0, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>
        <div style={{ padding:'18px 18px 14px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:28, height:28, background:'var(--brand)', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:14, color:'var(--text)', letterSpacing:'-0.3px' }}>GigForge</div>
              <div style={{ fontSize:10, color:'var(--brand)', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>Admin</div>
            </div>
          </div>
        </div>
        <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:'1px solid var(--border)' }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:12, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{session.email}</div>
              <div style={{ fontSize:11, color:'var(--text-3)' }}>Administrator</div>
            </div>
          </div>
        </div>
        <nav style={{ padding:'10px', flex:1 }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setView(item.id)} style={{ display:'flex', alignItems:'center', gap:9, width:'100%', padding:'8px 10px', borderRadius:8, border:'none', cursor:'pointer', background:view===item.id?'var(--brand)':'transparent', color:view===item.id?'#fff':'var(--text-2)', fontSize:13, fontWeight:view===item.id?600:400, textAlign:'left', marginBottom:1, transition:'all 0.1s' }}>
              {item.icon}
              <span style={{ flex:1 }}>{item.label}</span>
              {item.badge && <span style={{ fontSize:9, fontWeight:700, background:view===item.id?'rgba(255,255,255,0.2)':'var(--amber-bg)', color:view===item.id?'#fff':'var(--amber)', padding:'2px 6px', borderRadius:10 }}>{item.badge}</span>}
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
      <main style={{ flex:1, overflow:'auto', padding:'28px 32px' }}>
        {view === 'overview'     && <AdminOverview key={key} />}
        {view === 'workers'      && <AdminWorkers key={key} />}
        {view === 'claims'       && <AdminClaims onUpdate={refresh} key={key} />}
        {view === 'ledger'       && <AdminLedger key={key} />}
        {view === 'rides'        && <AdminRides key={key} />}
        {view === 'analytics'    && <AdminAnalytics key={key} />}
        {view === 'architecture' && <Part2Architecture key={key} />}
      </main>
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

function AdminOverview() {
  const [totals, setTotals] = useState<any>(null)
  const [platform, setPlatform] = useState<any>({})
  const [now, setNow] = useState(new Date())
  useEffect(() => { setTotals(getSystemTotals()); setPlatform(getPlatformStats()); const t = setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t) }, [])
  if (!totals) return null
  return (
    <div className="animate-up">
      <PageHeader title="System overview" sub={now.toLocaleString('en-IN',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',second:'2-digit'})}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ width:8, height:8, borderRadius:'50%', background:'var(--green)', animation:'pulse-dot 2s infinite' }} /><span style={{ fontSize:12, color:'var(--text-2)' }}>Live</span></div>
      </PageHeader>
      <div className="stagger" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:14, marginBottom:24 }}>
        <StatCard label="Total workers" value={totals.totalWorkers} accent="var(--brand)" />
        <StatCard label="Active shifts" value={totals.activeShifts} accent="var(--green)" />
        <StatCard label="Total rides" value={totals.totalRides} accent="var(--blue)" />
        <StatCard label="HR pool" value={`₹${totals.totalHRPool.toFixed(2)}`} accent="#7C3AED" />
        <StatCard label="Insurance pool" value={`₹${totals.totalInsPool.toFixed(2)}`} accent="var(--green)" />
        <StatCard label="Pending claims" value={totals.pendingClaims} accent={totals.pendingClaims>0?'var(--amber)':'var(--green)'} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Ride breakdown</div>
          {[['Total rides',totals.totalRides,'var(--text)'],['Completed',totals.completedRides,'var(--green)'],['Cancelled',totals.cancelledRides,'var(--red)'],['Completion rate',`${totals.totalRides>0?Math.round((totals.completedRides/totals.totalRides)*100):0}%`,'var(--blue)']].map(([l,v,c]:any) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:13, color:'var(--text-2)' }}>{l}</span>
              <span className="tabular" style={{ fontWeight:700, fontSize:14, color:c }}>{v}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Financial summary</div>
          {[['HR pool',`₹${totals.totalHRPool.toFixed(2)}`],['Insurance pool',`₹${totals.totalInsPool.toFixed(2)}`],['Combined fund',`₹${(totals.totalHRPool+totals.totalInsPool).toFixed(2)}`],['Ledger entries',totals.totalLedger],['Approved claims',totals.approvedClaims],['Avg reliability',`${totals.avgReliability}%`]].map(([l,v]:any) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:13, color:'var(--text-2)' }}>{l}</span>
              <span className="tabular" style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{v}</span>
            </div>
          ))}
        </Card>
      </div>
      {Object.keys(platform).length > 0 && (
        <Card>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Platform breakdown</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12 }}>
            {Object.entries(platform).map(([p, s]:any) => (
              <div key={p} style={{ padding:'12px 14px', background:'var(--bg)', borderRadius:9, borderLeft:'3px solid var(--brand)' }}>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:8 }}>{p}</div>
                <div style={{ fontSize:12, color:'var(--text-2)' }}>Accepted <strong>{s.accepted}</strong></div>
                <div style={{ fontSize:12, color:'var(--green)' }}>Completed <strong>{s.completed}</strong></div>
                <div style={{ fontSize:12, color:'var(--red)' }}>Cancelled <strong>{s.cancelled}</strong></div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Workers ───────────────────────────────────────────────────────────────────

function AdminWorkers() {
  const [workers, setWorkers] = useState<any[]>([])
  const [statsMap, setStatsMap] = useState<any>({})
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const ws = getAllWorkers(); const sts = getAllStats()
    setWorkers(ws)
    setStatsMap(Object.fromEntries(sts.map(s => [s.workerId, s])))
  }, [])

  const filtered = workers.filter(w => !search || [w.name,w.email,w.platform,w.city].some(x => x.toLowerCase().includes(search.toLowerCase())))

  const rows = filtered.map(w => {
    const s = statsMap[w.id]
    return [
      <div><div style={{ fontWeight:600, fontSize:13 }}>{w.name}</div><div style={{ fontSize:11, color:'var(--text-3)' }}>{w.email}</div></div>,
      w.platform, w.city, w.vehicleType,
      s ? <Badge color={s.reliabilityScore>=80?'green':s.reliabilityScore>=50?'amber':'red'}>{s.reliabilityScore}%</Badge> : '—',
      s ? s.totalRides : '—',
      s ? `₹${((s.hrFund||0)+(s.insuranceFund||0)).toFixed(2)}` : '—',
      <Btn size="sm" variant="ghost" onClick={() => setSelected(w)}>View</Btn>,
    ]
  })

  const sel = selected; const selStats = sel ? statsMap[sel.id] : null

  return (
    <div className="animate-up">
      <PageHeader title="Workers" sub={`${workers.length} registered`}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ padding:'8px 14px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, color:'var(--text)', outline:'none', width:260, fontFamily:'inherit' }} />
      </PageHeader>
      <Card><Table headers={['Worker','Platform','City','Vehicle','Reliability','Rides','Fund','Actions']} rows={rows} empty="No workers yet." /></Card>
      <Modal open={!!sel} onClose={() => setSelected(null)} title="Worker profile">
        {sel && <>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20, padding:'14px', background:'var(--bg)', borderRadius:10 }}>
            <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--brand-dim)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontSize:18, fontWeight:700, color:'var(--brand)' }}>{sel.name.charAt(0)}</span>
            </div>
            <div><div style={{ fontWeight:700, fontSize:15 }}>{sel.name}</div><div style={{ fontSize:12, color:'var(--text-3)' }}>{sel.platform} · {sel.vehicleType} · {sel.city}</div></div>
          </div>
          {[['Email',sel.email],['Phone',sel.phone],['Vehicle',sel.vehicleNumber],['Joined',new Date(sel.joinedAt).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})]].map(([l,v]) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{l}</span>
              <span style={{ fontSize:13, color:'var(--text)' }}>{v}</span>
            </div>
          ))}
          {selStats && <>
            <div style={{ marginTop:16, marginBottom:10 }}><ScoreBar value={selStats.reliabilityScore} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
              {[['Rides',selStats.totalRides],['Completed',selStats.completedRides],['HR fund',`₹${(selStats.hrFund||0).toFixed(2)}`],['Insurance',`₹${(selStats.insuranceFund||0).toFixed(2)}`],['Hours',`${(selStats.totalWorkHours||0).toFixed(1)}h`],['Risk',selStats.riskScore]].map(([l,v]:any) => (
                <div key={l} style={{ padding:'10px', background:'var(--bg)', borderRadius:8, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:3 }}>{l}</div>
                  <div className="tabular" style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{v}</div>
                </div>
              ))}
            </div>
          </>}
        </>}
      </Modal>
    </div>
  )
}

// ── Claims ────────────────────────────────────────────────────────────────────

function AdminClaims({ onUpdate }: { onUpdate: () => void }) {
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [selected, setSelected] = useState<InsuranceClaim|null>(null)
  const [payout, setPayout] = useState('')
  const [notes, setNotes] = useState('')
  const [filter, setFilter] = useState('All')

  const load = () => setClaims(getAllClaims())
  useEffect(() => { load() }, [])

  const review = (status: InsuranceClaim['status']) => {
    if (!selected) return
    updateClaimStatus(selected.id, status, status==='Approved' ? (+payout||selected.amount) : undefined)
    setSelected(null); setPayout(''); setNotes('')
    load(); onUpdate()
  }

  const filtered = filter==='All' ? claims : claims.filter(c => c.status===filter)
  const rows = filtered.map(c => {
    const w = getWorkerById(c.workerId)
    return [<span className="mono" style={{fontSize:11,color:'var(--text-3)'}}>{c.id.slice(-8).toUpperCase()}</span>, <div><div style={{fontSize:13,fontWeight:500}}>{w?.name||'Unknown'}</div><div style={{fontSize:11,color:'var(--text-3)'}}>{w?.platform}</div></div>, c.type, <strong>₹{c.amount.toLocaleString('en-IN')}</strong>, <Badge color={sc[c.status]}>{c.status}</Badge>, `${c.eligibilityScore}%`, new Date(c.submittedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'}), <Btn size="sm" variant="ghost" onClick={() => { setSelected(c); setPayout(String(c.amount)) }}>Review</Btn>]
  })

  return (
    <div className="animate-up">
      <PageHeader title="Insurance claims" sub={`${claims.filter(c=>c.status==='Pending').length} pending review`}>
        <div style={{ display:'flex', gap:6 }}>
          {['All','Pending','Under Review','Approved','Rejected'].map(s => <Btn key={s} size="sm" variant={filter===s?'primary':'ghost'} onClick={() => setFilter(s)}>{s}</Btn>)}
        </div>
      </PageHeader>
      <Card><Table headers={['ID','Worker','Type','Amount','Status','Eligibility','Filed','Actions']} rows={rows} empty="No claims." /></Card>
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Review claim">
        {selected && <>
          {[['ID',selected.id.slice(-8).toUpperCase()],['Type',selected.type],['Amount',`₹${selected.amount.toLocaleString('en-IN')}`],['Eligibility',`${selected.eligibilityScore}%`],['Status',<Badge color={sc[selected.status]}>{selected.status}</Badge>],['Description',selected.description]].map(([l,v]:any) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{l}</span>
              <span style={{ fontSize:13, color:'var(--text)', textAlign:'right', maxWidth:'60%' }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop:16 }}>
            <Field label="Payout amount (₹)"><input value={payout} onChange={e => setPayout(e.target.value)} type="number" style={{ width:'100%', padding:'9px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, color:'var(--text)', outline:'none', fontFamily:'inherit' }} /></Field>
            <Field label="Adjudicator notes"><Textarea value={notes} onChange={setNotes} placeholder="Internal notes…" rows={2} /></Field>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <Btn onClick={() => review('Approved')} style={{ flex:1, background:'var(--green)' }}>Approve</Btn>
              <Btn onClick={() => review('Rejected')} variant="danger" style={{ flex:1 }}>Reject</Btn>
              <Btn onClick={() => review('Under Review')} variant="ghost">Under review</Btn>
            </div>
          </div>
        </>}
      </Modal>
    </div>
  )
}

// ── Ledger ────────────────────────────────────────────────────────────────────

function AdminLedger() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [filter, setFilter] = useState<'all'|'HR'|'Insurance'>('all')
  useEffect(() => { setLedger(getAllLedger()) }, [])
  const exportCSV = () => {
    const rows = [['WorkerID','Type','Amount','Event','Timestamp','Balance','BlockHash']].concat(ledger.map(l=>[l.workerId,l.type,l.amount.toString(),l.eventType,l.timestamp,l.balance.toString(),l.blockHash]))
    const a = document.createElement('a'); a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(rows.map(r=>r.join(',')).join('\n')); a.download='gigforge_platform_ledger.csv'; a.click()
  }
  const filtered = filter==='all' ? ledger : ledger.filter(l=>l.type===filter)
  const totalHR = ledger.filter(l=>l.type==='HR').reduce((s,l)=>s+l.amount,0)
  const totalIns = ledger.filter(l=>l.type==='Insurance').reduce((s,l)=>s+l.amount,0)
  const rows = filtered.map(e => {
    const w = getWorkerById(e.workerId)
    return [<span className="mono" style={{fontSize:11,color:'var(--text-3)'}}>{e.blockHash.slice(0,12)}</span>, <div><div style={{fontSize:12,fontWeight:500}}>{w?.name||'Unknown'}</div><div style={{fontSize:11,color:'var(--text-3)'}}>{w?.platform}</div></div>, <Badge color={e.type==='HR'?'blue':'green'}>{e.type}</Badge>, <strong>₹{e.amount.toFixed(2)}</strong>, <Badge color={ec[e.eventType]}>{el[e.eventType]}</Badge>, new Date(e.timestamp).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})]
  })
  return (
    <div className="animate-up">
      <PageHeader title="Platform ledger" sub="All financial entries across all workers.">
        <div style={{ display:'flex', gap:6 }}>
          {(['all','HR','Insurance'] as const).map(f => <Btn key={f} size="sm" variant={filter===f?'primary':'ghost'} onClick={() => setFilter(f)}>{f==='all'?'All':f}</Btn>)}
          <Btn size="sm" variant="secondary" onClick={exportCSV}>Export CSV</Btn>
        </div>
      </PageHeader>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
        <StatCard label="HR pool" value={`₹${totalHR.toFixed(2)}`} accent="var(--blue)" />
        <StatCard label="Insurance pool" value={`₹${totalIns.toFixed(2)}`} accent="var(--green)" />
        <StatCard label="Total entries" value={ledger.length} accent="var(--brand)" />
      </div>
      <Card><Table headers={['Block hash','Worker','Type','Amount','Event','Timestamp']} rows={rows} empty="No ledger entries yet." /></Card>
    </div>
  )
}

// ── Rides ─────────────────────────────────────────────────────────────────────

function AdminRides() {
  const [rides, setRides] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  useEffect(() => { setRides(getAllRides()) }, [])
  const filtered = filter==='all' ? rides : rides.filter(r=>r.type===filter)
  const rows = filtered.map(r => { const w=getWorkerById(r.workerId); return [<span className="mono" style={{fontSize:11,color:'var(--text-3)'}}>{r.id.slice(-8).toUpperCase()}</span>, <div><div style={{fontSize:12,fontWeight:500}}>{w?.name||'Unknown'}</div><div style={{fontSize:11,color:'var(--text-3)'}}>{w?.city}</div></div>, r.platform, <Badge color={ec[r.type]}>{el[r.type]}</Badge>, r.pickupLocation||'—', r.dropLocation||'—', r.distanceKm?`${r.distanceKm} km`:'—', r.fareAmount?`₹${r.fareAmount}`:'—', new Date(r.timestamp).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})] })
  return (
    <div className="animate-up">
      <PageHeader title="Ride events" sub={`${rides.length} total events`}>
        <div style={{ display:'flex', gap:6 }}>
          {[['all','All'],['ride_accepted','Accepted'],['ride_completed','Completed'],['ride_cancelled','Cancelled']].map(([v,l]) => <Btn key={v} size="sm" variant={filter===v?'primary':'ghost'} onClick={() => setFilter(v)}>{l}</Btn>)}
        </div>
      </PageHeader>
      <Card><Table headers={['ID','Worker','Platform','Event','Pickup','Drop','Dist','Fare','Time']} rows={rows} empty="No rides yet." /></Card>
    </div>
  )
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function AdminAnalytics() {
  const [workers, setWorkers] = useState<any[]>([])
  const [stats, setStats] = useState<WorkerStats[]>([])
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  useEffect(() => { setWorkers(getAllWorkers()); setStats(getAllStats()); setLedger(getAllLedger()) }, [])

  const topWorkers = stats.map(s => ({ ...s, worker:workers.find(w=>w.id===s.workerId), total:(s.hrFund||0)+(s.insuranceFund||0) })).filter(s=>s.worker).sort((a,b)=>b.total-a.total).slice(0,5)

  const dailyData = Array.from({ length:7 }, (_,i) => {
    const start = Date.now() - (6-i)*86400000; const end = start + 86400000
    const day = ledger.filter(l => { const t=new Date(l.timestamp).getTime(); return t>=start&&t<end })
    return { date:new Date(start).toLocaleDateString('en-IN',{weekday:'short',day:'numeric'}), hr:day.filter(l=>l.type==='HR').reduce((s,l)=>s+l.amount,0), ins:day.filter(l=>l.type==='Insurance').reduce((s,l)=>s+l.amount,0) }
  })
  const maxDay = Math.max(...dailyData.map(d=>d.hr+d.ins), 1)

  return (
    <div className="animate-up">
      <PageHeader title="Analytics" sub="Platform-wide metrics and worker intelligence." />
      <Card style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:20 }}>Daily contributions — last 7 days</div>
        <div style={{ display:'flex', alignItems:'flex-end', gap:10, height:120 }}>
          {dailyData.map((d,i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:2, height:100, justifyContent:'flex-end' }}>
                <div style={{ width:'100%', background:'var(--green)', height:`${(d.ins/maxDay)*100}%`, minHeight:d.ins>0?4:0, borderRadius:'3px 3px 0 0', transition:'height 0.5s ease' }} />
                <div style={{ width:'100%', background:'var(--blue)', height:`${(d.hr/maxDay)*100}%`, minHeight:d.hr>0?4:0, borderRadius:'3px 3px 0 0', transition:'height 0.5s ease' }} />
              </div>
              <div style={{ fontSize:10, color:'var(--text-3)', textAlign:'center', whiteSpace:'nowrap' }}>{d.date}</div>
              <div className="tabular" style={{ fontSize:10, fontWeight:600, color:'var(--text-2)' }}>₹{(d.hr+d.ins).toFixed(0)}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:16, marginTop:12 }}>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}><div style={{ width:10, height:10, background:'var(--blue)', borderRadius:2 }}/><span style={{ fontSize:11, color:'var(--text-2)' }}>HR</span></div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}><div style={{ width:10, height:10, background:'var(--green)', borderRadius:2 }}/><span style={{ fontSize:11, color:'var(--text-2)' }}>Insurance</span></div>
        </div>
      </Card>
      <Card>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Top workers by accumulated fund</div>
        {topWorkers.length === 0 ? <div style={{ textAlign:'center', padding:32, color:'var(--text-3)', fontSize:13 }}>No data yet.</div>
          : topWorkers.map((s,i) => (
            <div key={s.workerId} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:i===0?'var(--amber-bg)':'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:700, color:i===0?'var(--amber)':'var(--text-2)' }}>#{i+1}</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>{s.worker?.name}</div>
                <div style={{ fontSize:11, color:'var(--text-3)' }}>{s.worker?.platform} · {s.totalRides} rides · {s.reliabilityScore}% reliability</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div className="tabular" style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>₹{s.total.toFixed(2)}</div>
                <div style={{ fontSize:11, color:'var(--text-3)' }}>HR ₹{(s.hrFund||0).toFixed(2)} · Ins ₹{(s.insuranceFund||0).toFixed(2)}</div>
              </div>
            </div>
          ))}
      </Card>
    </div>
  )
}

// ── Part 2 Architecture ───────────────────────────────────────────────────────

function Part2Architecture() {
  return (
    <div className="animate-up">
      <PageHeader title="Part 2 — Production architecture" sub="The paid, scalable system design behind GigForge at real infrastructure scale." />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <Card style={{ borderTop:'3px solid var(--amber)' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:14 }}>Part 1 (Free — what you're using now)</div>
          <div className="mono" style={{ fontSize:12, color:'var(--text-2)', lineHeight:2 }}>
            Next.js → API Route<br/>
            Redis (Upstash) → event queue<br/>
            PostgreSQL (Neon DB) → ledger<br/>
            Vercel → hosting<br/>
            localStorage → session
          </div>
          <div style={{ marginTop:12, padding:'8px 12px', background:'var(--green-bg)', borderRadius:8, fontSize:12, color:'var(--green)', fontWeight:600 }}>Cost: ₹0/month · Free forever tier</div>
        </Card>
        <Card style={{ borderTop:'3px solid var(--brand)' }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:14 }}>Part 2 (Production — paid infra)</div>
          <div className="mono" style={{ fontSize:12, color:'var(--text-2)', lineHeight:2 }}>
            Next.js → AWS API Gateway<br/>
            Apache Kafka (MSK) → event bus<br/>
            PostgreSQL Aurora (RDS) → ledger<br/>
            Redis ElastiCache → cache<br/>
            AWS EKS (Kubernetes) → services
          </div>
          <div style={{ marginTop:12, padding:'8px 12px', background:'var(--amber-bg)', borderRadius:8, fontSize:12, color:'var(--amber)', fontWeight:600 }}>Cost: ~₹80,000/month for 10k workers</div>
        </Card>
      </div>

      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Microservices architecture (Part 2)</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { name:'Identity Service', desc:'Auth, OTP, JWT tokens, role management, worker profiles', port:'8001', tech:'FastAPI + PostgreSQL' },
            { name:'Ride Event Service', desc:'Receives ride events, validates, publishes to Kafka topics', port:'8002', tech:'FastAPI + Kafka Producer' },
            { name:'Contribution Service', desc:'Kafka consumer — calculates and writes ledger entries', port:'8003', tech:'FastAPI + PostgreSQL' },
            { name:'Insurance Service', desc:'Eligibility engine, claim processing, payout logic', port:'8004', tech:'FastAPI + PostgreSQL' },
            { name:'Worker Intelligence', desc:'AI risk scoring, reliability model, fraud detection', port:'8005', tech:'FastAPI + Scikit-learn' },
            { name:'Analytics Service', desc:'Aggregations, dashboards, ClickHouse queries', port:'8006', tech:'FastAPI + ClickHouse' },
          ].map(s => (
            <div key={s.name} style={{ padding:'14px', background:'var(--bg)', borderRadius:9, borderLeft:'3px solid var(--brand)' }}>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', marginBottom:4 }}>{s.name}</div>
              <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8, lineHeight:1.5 }}>{s.desc}</div>
              <div className="mono" style={{ fontSize:10, color:'var(--brand)' }}>:{s.port} · {s.tech}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Kafka event flow</div>
        <div className="mono" style={{ fontSize:12, color:'var(--text-2)', lineHeight:2.2, padding:'4px 0' }}>
          <span style={{ color:'var(--blue)' }}>ride_accepted / ride_completed / ride_cancelled</span><br/>
          &nbsp;&nbsp;→ Ride Event Service validates + publishes to <span style={{ color:'var(--brand)' }}>Kafka topic: ride.events</span><br/>
          &nbsp;&nbsp;→ Contribution Consumer: writes ledger entries (HR + Insurance)<br/>
          &nbsp;&nbsp;→ Stats Consumer: updates worker reliability + risk scores<br/>
          &nbsp;&nbsp;→ AI Consumer: feeds risk model with new data point<br/>
          &nbsp;&nbsp;→ Analytics Consumer: updates ClickHouse aggregations<br/>
          <br/>
          <span style={{ color:'var(--text-3)' }}>Idempotency: event IDs deduplicated — same ride never counted twice</span><br/>
          <span style={{ color:'var(--text-3)' }}>Event replay: Kafka retention 7 days — full state rebuild possible anytime</span>
        </div>
      </Card>

      <Card style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Infrastructure + DevOps (Part 2)</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
          {[
            { layer:'Compute', part1:'Vercel + Render', part2:'AWS EKS (Kubernetes)', cost:'₹25,000/mo' },
            { layer:'Database', part1:'Neon DB (PostgreSQL)', part2:'AWS RDS Aurora', cost:'₹15,000/mo' },
            { layer:'Event streaming', part1:'Upstash Redis (Pub/Sub)', part2:'AWS MSK (Kafka)', cost:'₹20,000/mo' },
            { layer:'Cache', part1:'Upstash Redis', part2:'AWS ElastiCache', cost:'₹8,000/mo' },
            { layer:'Storage', part1:'Cloudflare R2', part2:'AWS S3', cost:'₹1,000/mo' },
            { layer:'Observability', part1:'Render logs', part2:'Prometheus + Grafana + ELK', cost:'₹12,000/mo' },
          ].map(row => (
            <div key={row.layer} style={{ padding:'12px', background:'var(--bg)', borderRadius:9 }}>
              <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', marginBottom:6 }}>{row.layer}</div>
              <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:2 }}>Free: {row.part1}</div>
              <div style={{ fontSize:11, color:'var(--blue)', marginBottom:4 }}>Paid: {row.part2}</div>
              <Badge color="amber">{row.cost}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:16 }}>Migration path — Part 1 → Part 2</div>
        <div style={{ display:'grid', gap:10 }}>
          {[
            { step:'1', title:'Replace Redis Pub/Sub with Kafka', detail:'Change event publisher to Kafka producer. Consumers remain identical — only the transport changes. Zero application logic change.' },
            { step:'2', title:'Migrate Neon DB → RDS Aurora', detail:'pg_dump from Neon, restore to Aurora. Update DATABASE_URL. All SQL is standard PostgreSQL — zero schema changes needed.' },
            { step:'3', title:'Deploy microservices on EKS', detail:'Each service already has a Docker container. Apply Kubernetes manifests. Use AWS ALB Ingress for API Gateway.' },
            { step:'4', title:'Add observability stack', detail:'Deploy Prometheus + Grafana via Helm charts. Ship logs to Elasticsearch. Add OpenTelemetry SDK (3 lines per service).' },
            { step:'5', title:'Enable AI intelligence service', detail:'Deploy Worker Intelligence Service. Feed historical ride/ledger data. Enable real-time risk scoring on every event.' },
          ].map(s => (
            <div key={s.step} style={{ display:'flex', gap:14, padding:'14px', background:'var(--bg)', borderRadius:9 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--brand)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontWeight:700, fontSize:13, color:'#fff' }}>{s.step}</span>
              </div>
              <div>
                <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', marginBottom:4 }}>{s.title}</div>
                <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.5 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
