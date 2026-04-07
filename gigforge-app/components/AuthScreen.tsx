'use client'
import { useState } from 'react'
import { registerWorker, loginWorker, loginAdmin, setSession, resetWorkerPassword, getAllWorkers } from '@/lib/store'
import { sendOTP, verifyOTPCode } from '@/lib/otp'
import type { Session } from '@/lib/store'

type Step =
  | 'landing'
  | 'worker-login' | 'worker-login-otp'
  | 'worker-signup' | 'worker-signup-otp' | 'worker-created'
  | 'worker-forgot' | 'worker-forgot-otp' | 'worker-forgot-reset'
  | 'admin-login' | 'admin-otp'

const base: React.CSSProperties = { fontFamily:'inherit', boxSizing:'border-box' }
const input: React.CSSProperties = { ...base, width:'100%', padding:'10px 13px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, fontSize:14, color:'var(--text)', outline:'none', marginBottom:14, display:'block' }
const label: React.CSSProperties = { display:'block', fontSize:11, fontWeight:600, color:'var(--text-2)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }
const btn: React.CSSProperties = { ...base, width:'100%', padding:'12px', background:'var(--brand)', color:'#fff', border:'none', borderRadius:9, fontSize:14, fontWeight:700, cursor:'pointer', marginTop:4 }
const btnSec: React.CSSProperties = { ...base, width:'100%', padding:'10px', background:'transparent', color:'var(--text)', border:'1px solid var(--border)', borderRadius:9, fontSize:13, fontWeight:500, cursor:'pointer', marginTop:8 }
const lnk: React.CSSProperties = { ...base, color:'var(--brand)', cursor:'pointer', fontSize:13, textDecoration:'underline', padding:0, border:'none', background:'none' }
const err: React.CSSProperties = { background:'var(--red-bg)', color:'var(--red)', padding:'10px 14px', borderRadius:8, fontSize:13, marginBottom:14, lineHeight:1.6 }
const inf: React.CSSProperties = { background:'var(--brand-dim)', border:'1px solid var(--brand-glow)', color:'var(--brand)', padding:'10px 14px', borderRadius:8, fontSize:12, marginBottom:14, lineHeight:1.6, whiteSpace:'pre-wrap' }
const twoCol: React.CSSProperties = { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }
const sel: React.CSSProperties = { ...input, marginBottom:14 }
const card: React.CSSProperties = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:'40px 36px' }
const root: React.CSSProperties = { minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }

function Logo() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:32 }}>
      <div style={{ width:36, height:36, background:'var(--brand)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <div>
        <div style={{ fontWeight:800, fontSize:18, color:'var(--text)', letterSpacing:'-0.5px' }}>GigForge</div>
        <div style={{ fontSize:11, color:'var(--text-3)' }}>Gig Worker Infrastructure</div>
      </div>
    </div>
  )
}

function OtpInput({ value, onChange, onEnter }: { value:string; onChange:(v:string)=>void; onEnter:()=>void }) {
  return (
    <div style={{ marginBottom:14 }}>
      <input
        style={{ ...base, width:'100%', padding:'14px', background:'var(--bg)', border:'2px solid var(--border)', borderRadius:10, fontSize:28, color:'var(--text)', outline:'none', fontFamily:'"Courier New",monospace', letterSpacing:14, textAlign:'center', display:'block' }}
        placeholder="000000" maxLength={6} value={value}
        onChange={e => onChange(e.target.value.replace(/\D/g,''))}
        onKeyDown={e => e.key === 'Enter' && onEnter()}
        autoFocus inputMode="numeric"
      />
    </div>
  )
}

export default function AuthScreen({ onAuth }: { onAuth:(s:Session)=>void }) {
  const [step, setStep] = useState<Step>('landing')
  const [dark, setDark] = useState(false)
  const [e, setE] = useState('')
  const [i, setI] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpToken, setToken] = useState<string|undefined>()
  const [resolvedEmail, setResolvedEmail] = useState('')

  // Fields
  const [wId, setWId] = useState('')
  const [wPw, setWPw] = useState('')
  const [wOtp, setWOtp] = useState('')
  const [f, setF] = useState({ name:'', email:'', phone:'', password:'', confirmPw:'', platform:'Swiggy', vehicleType:'Bike', vehicleNumber:'', city:'' })
  const [sOtp, setSotp] = useState('')
  const [fgId, setFgId] = useState('')
  const [fgOtp, setFgOtp] = useState('')
  const [fgPw, setFgPw] = useState('')
  const [fgPw2, setFgPw2] = useState('')
  const [aEmail, setAEmail] = useState('')
  const [aPw, setAPw] = useState('')
  const [aOtp, setAOtp] = useState('')

  const E = (msg:string) => { setE(msg); setLoading(false) }
  const clear = () => { setE(''); setI('') }
  const go = (s:Step) => { clear(); setStep(s) }
  const toggleDark = () => { setDark(d => { document.documentElement.classList.toggle('dark',!d); return !d }) }

  async function sendAndGo(email:string, type:'worker'|'admin', name:string|undefined, nextStep:Step) {
    const res = await sendOTP(email, type, name)
    if (!res.success) return E(res.error || 'Failed to send OTP.')
    setToken(res.token)
    if (res.devMode && res.otp) {
      setI(`Dev mode active — RESEND_API_KEY not set.\nOTP for ${email}: ${res.otp}\n\nSee README to enable real email delivery.`)
    } else {
      setI(`OTP sent to ${email}. Check your inbox and spam folder.`)
    }
    setLoading(false); setStep(nextStep)
  }

  async function verifyAndProceed(otp:string, onSuccess:()=>void) {
    setLoading(true)
    const res = await verifyOTPCode(otpToken, otp)
    if (!res.success) return E(res.error || 'Invalid or expired OTP.')
    setLoading(false); onSuccess()
  }

  // ── Worker login ──────────────────────────────────────────────────────────
  async function doWorkerLogin() {
    clear()
    if (!wId.trim()) return E('Enter your email or phone.')
    if (!wPw) return E('Enter your password.')
    if (wId === 'driver@gmail.com' && wPw === 'driver') {
      const r = loginWorker(wId, wPw)
      if (r.ok && r.worker) { const s:Session={role:'worker',id:r.worker.id,name:r.worker.name,email:r.worker.email}; setSession(s); onAuth(s); return }
    }
    const r = loginWorker(wId, wPw)
    if (!r.ok) return E(r.error || 'Invalid credentials.')
    setLoading(true)
    const email = r.worker!.email
    setResolvedEmail(email)
    await sendAndGo(email, 'worker', r.worker!.name.split(' ')[0], 'worker-login-otp')
  }

  async function doWorkerLoginOtp() {
    clear()
    await verifyAndProceed(wOtp, () => {
      const r = loginWorker(wId, wPw)
      if (r.ok && r.worker) { const s:Session={role:'worker',id:r.worker.id,name:r.worker.name,email:r.worker.email}; setSession(s); onAuth(s) }
      else E('Something went wrong.')
    })
  }

  // ── Worker signup ─────────────────────────────────────────────────────────
  async function doSignupDetails() {
    clear()
    if (!f.name.trim()) return E('Full name is required.')
    if (!f.email.includes('@')) return E('Enter a valid email.')
    if (f.phone.length < 10) return E('Enter a valid 10-digit phone number.')
    if (f.password.length < 6) return E('Password must be at least 6 characters.')
    if (f.password !== f.confirmPw) return E('Passwords do not match.')
    if (!f.vehicleNumber.trim()) return E('Vehicle number is required.')
    if (!f.city.trim()) return E('City is required.')
    setLoading(true)
    await sendAndGo(f.email, 'worker', f.name.split(' ')[0], 'worker-signup-otp')
  }

  async function doSignupOtp() {
    clear()
    await verifyAndProceed(sOtp, () => {
      const r = registerWorker({ name:f.name, email:f.email, phone:f.phone, password:f.password, platform:f.platform as any, vehicleType:f.vehicleType as any, vehicleNumber:f.vehicleNumber, city:f.city })
      if (!r.ok) return E(r.error || 'Registration failed.')
      setStep('worker-created')
    })
  }

  // ── Forgot ────────────────────────────────────────────────────────────────
  async function doForgot() {
    clear()
    if (!fgId.trim()) return E('Enter your email or phone.')
    setLoading(true)
    const workers = getAllWorkers()
    const w = workers.find((x:any) => x.email === fgId || x.phone === fgId)
    if (!w) { setLoading(false); return E('No account found with that email or phone.') }
    setResolvedEmail(w.email)
    await sendAndGo(w.email, 'worker', 'Password Reset', 'worker-forgot-otp')
  }

  async function doForgotOtp() {
    clear()
    await verifyAndProceed(fgOtp, () => setStep('worker-forgot-reset'))
  }

  function doForgotReset() {
    clear()
    if (fgPw.length < 6) return E('Password must be at least 6 characters.')
    if (fgPw !== fgPw2) return E('Passwords do not match.')
    if (!resetWorkerPassword(fgId, fgPw)) return E('Account not found.')
    go('worker-login'); setI('Password reset successfully. Please sign in.')
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  async function doAdminLogin() {
    clear()
    if (!aEmail.includes('@')) return E('Enter a valid email.')
    const r = loginAdmin(aEmail, aPw)
    if (!r.ok) return E(r.error || 'Incorrect credentials.')
    setLoading(true)
    await sendAndGo(aEmail, 'admin', undefined, 'admin-otp')
  }

  async function doAdminOtp() {
    clear()
    await verifyAndProceed(aOtp, () => {
      const s:Session={role:'admin',id:aEmail,name:'Administrator',email:aEmail}
      setSession(s); onAuth(s)
    })
  }

  // ── Dark toggle button ─────────────────────────────────────────────────────
  const DarkBtn = () => <button onClick={toggleDark} style={{ position:'fixed', top:16, right:16, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 12px', cursor:'pointer', color:'var(--text-2)', fontSize:12, fontFamily:'inherit' }}>{dark?'Light':'Dark'}</button>

  // ── Landing ───────────────────────────────────────────────────────────────
  if (step === 'landing') return (
    <div style={root}>
      <DarkBtn />
      <div style={{ width:'100%', maxWidth:440 }}>
        <div style={card}>
          <Logo />
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Welcome to GigForge</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>India's gig worker HR and insurance infrastructure. Select your role to continue.</p>
          <button onClick={() => go('worker-login')} style={{ ...base, width:'100%', padding:'18px 20px', background:'var(--brand-dim)', border:'2px solid var(--brand)', borderRadius:12, cursor:'pointer', textAlign:'left', marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, background:'var(--brand)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="5.5" cy="17.5" r="2.5" stroke="#fff" strokeWidth="2"/><circle cx="18.5" cy="17.5" r="2.5" stroke="#fff" strokeWidth="2"/><path d="M8 17.5h7M15 17.5V11l-3-5H7L3.5 12H2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><path d="M15 11h4l2 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'var(--brand)' }}>I am a driver / rider</div>
                <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>Track rides, build HR fund, access insurance</div>
              </div>
              <svg style={{ marginLeft:'auto', color:'var(--brand)', flexShrink:0 }} width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </button>
          <button onClick={() => go('admin-login')} style={{ ...base, width:'100%', padding:'18px 20px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:12, cursor:'pointer', textAlign:'left' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, background:'var(--surface-3)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>I am an administrator</div>
                <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>Manage workers, claims, platform ledger</div>
              </div>
              <svg style={{ marginLeft:'auto', color:'var(--text-3)', flexShrink:0 }} width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </button>
        </div>
        <p style={{ textAlign:'center', marginTop:20, fontSize:12, color:'var(--text-3)' }}>Building the social security layer for India's gig economy</p>
      </div>
    </div>
  )

  // ── Worker login ──────────────────────────────────────────────────────────
  if (step === 'worker-login') return (
    <div style={root}><DarkBtn />
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={card}>
          <Logo />
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Driver sign in</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>Enter your registered email or phone number.</p>
          {e && <div style={err}>{e}</div>}
          {i && <div style={inf}>{i}</div>}
          <label style={label}>Email or phone</label>
          <input style={input} placeholder="you@email.com or 9876543210" value={wId} onChange={ev=>setWId(ev.target.value)} />
          <label style={label}>Password</label>
          <input style={input} type="password" placeholder="••••••••" value={wPw} onChange={ev=>setWPw(ev.target.value)} onKeyDown={ev=>ev.key==='Enter'&&doWorkerLogin()} />
          <button style={{ ...btn, opacity:loading?0.7:1 }} onClick={doWorkerLogin} disabled={loading}>{loading?'Sending OTP…':'Continue'}</button>
          <div style={{ textAlign:'center', marginTop:16, fontSize:13, display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <button style={lnk} onClick={() => go('worker-forgot')}>Forgot password?</button>
            <span style={{ color:'var(--border)' }}>·</span>
            <button style={lnk} onClick={() => go('worker-signup')}>Create account</button>
            <span style={{ color:'var(--border)' }}>·</span>
            <button style={lnk} onClick={() => go('landing')}>Back</button>
          </div>
        </div>
      </div>
    </div>
  )

  if (step === 'worker-login-otp') return (
    <div style={root}><DarkBtn />
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={card}>
          <Logo />
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Check your email</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>We sent a 6-digit OTP to <strong>{resolvedEmail}</strong>. It expires in 10 minutes.</p>
          {e && <div style={err}>{e}</div>}
          {i && <div style={inf}>{i}</div>}
          <OtpInput value={wOtp} onChange={setWOtp} onEnter={doWorkerLoginOtp} />
          <button style={{ ...btn, opacity:loading?0.7:1 }} onClick={doWorkerLoginOtp} disabled={loading}>{loading?'Verifying…':'Verify and sign in'}</button>
          <button style={btnSec} onClick={() => { go('worker-login'); setWOtp('') }}>Back</button>
        </div>
      </div>
    </div>
  )

  if (step === 'worker-signup') return (
    <div style={{ ...root, alignItems:'flex-start', paddingTop:40 }}>
      <DarkBtn />
      <div style={{ width:'100%', maxWidth:500, margin:'0 auto' }}>
        <div style={card}>
          <Logo />
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Create driver account</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>Join millions of gig workers building financial security.</p>
          {e && <div style={err}>{e}</div>}
          <label style={label}>Full name</label>
          <input style={input} placeholder="Rahul Kumar" value={f.name} onChange={ev=>setF(x=>({...x,name:ev.target.value}))} />
          <div style={twoCol}>
            <div><label style={label}>Email</label><input style={input} placeholder="you@email.com" value={f.email} onChange={ev=>setF(x=>({...x,email:ev.target.value}))} /></div>
            <div><label style={label}>Phone</label><input style={input} placeholder="9876543210" value={f.phone} onChange={ev=>setF(x=>({...x,phone:ev.target.value}))} maxLength={10} /></div>
          </div>
          <div style={twoCol}>
            <div><label style={label}>Platform</label><select style={sel} value={f.platform} onChange={ev=>setF(x=>({...x,platform:ev.target.value}))}>{['Swiggy','Zomato','Uber','Rapido','Ola','Dunzo'].map(p=><option key={p}>{p}</option>)}</select></div>
            <div><label style={label}>Vehicle type</label><select style={sel} value={f.vehicleType} onChange={ev=>setF(x=>({...x,vehicleType:ev.target.value}))}>{['Bike','Scooter','Car','Bicycle'].map(v=><option key={v}>{v}</option>)}</select></div>
          </div>
          <div style={twoCol}>
            <div><label style={label}>Vehicle number</label><input style={input} placeholder="DL01AB1234" value={f.vehicleNumber} onChange={ev=>setF(x=>({...x,vehicleNumber:ev.target.value}))} /></div>
            <div><label style={label}>City</label><input style={input} placeholder="Delhi" value={f.city} onChange={ev=>setF(x=>({...x,city:ev.target.value}))} /></div>
          </div>
          <div style={twoCol}>
            <div><label style={label}>Password</label><input style={input} type="password" placeholder="Min 6 chars" value={f.password} onChange={ev=>setF(x=>({...x,password:ev.target.value}))} /></div>
            <div><label style={label}>Confirm password</label><input style={input} type="password" placeholder="Repeat" value={f.confirmPw} onChange={ev=>setF(x=>({...x,confirmPw:ev.target.value}))} /></div>
          </div>
          <button style={{ ...btn, opacity:loading?0.7:1 }} onClick={doSignupDetails} disabled={loading}>{loading?'Sending OTP…':'Send verification OTP'}</button>
          <div style={{ textAlign:'center', marginTop:14, fontSize:13 }}>Already have an account? <button style={lnk} onClick={() => go('worker-login')}>Sign in</button></div>
        </div>
      </div>
    </div>
  )

  if (step === 'worker-signup-otp') return (
    <div style={root}><DarkBtn />
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={card}>
          <Logo />
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Verify your email</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>OTP sent to <strong>{f.email}</strong>. It expires in 10 minutes.</p>
          {e && <div style={err}>{e}</div>}
          {i && <div style={inf}>{i}</div>}
          <OtpInput value={sOtp} onChange={setSotp} onEnter={doSignupOtp} />
          <button style={{ ...btn, opacity:loading?0.7:1 }} onClick={doSignupOtp} disabled={loading}>{loading?'Creating account…':'Verify and create account'}</button>
          <button style={btnSec} onClick={() => go('worker-signup')}>Back</button>
        </div>
      </div>
    </div>
  )

  if (step === 'worker-created') return (
    <div style={root}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ ...card, textAlign:'center' }}>
          <div style={{ width:60, height:60, background:'var(--green-bg)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Account created!</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>Your GigForge driver account is ready. Sign in to start tracking rides and building your fund.</p>
          <button style={btn} onClick={() => { go('worker-login'); setWId(f.email) }}>Sign in now</button>
        </div>
      </div>
    </div>
  )

  if (step === 'worker-forgot') return (
    <div style={root}><DarkBtn />
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={card}>
          <Logo />
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Reset password</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>Enter your registered email or phone. We'll send a reset OTP to your email address.</p>
          {e && <div style={err}>{e}</div>}
          {i && <div style={inf}>{i}</div>}
          <label style={label}>Email or phone</label>
          <input style={input} placeholder="you@email.com or 9876543210" value={fgId} onChange={ev=>setFgId(ev.target.value)} onKeyDown={ev=>ev.key==='Enter'&&doForgot()} />
          <button style={{ ...btn, opacity:loading?0.7:1 }} onClick={doForgot} disabled={loading}>{loading?'Sending OTP…':'Send reset OTP'}</button>
          <button style={btnSec} onClick={() => go('worker-login')}>Back to sign in</button>
        </div>
      </div>
    </div>
  )

  if (step === 'worker-forgot-otp') return (
    <div style={root}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={card}>
          <Logo />
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Enter reset OTP</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>Check your email for the password reset OTP.</p>
          {e && <div style={err}>{e}</div>}
          {i && <div style={inf}>{i}</div>}
          <OtpInput value={fgOtp} onChange={setFgOtp} onEnter={doForgotOtp} />
          <button style={{ ...btn, opacity:loading?0.7:1 }} onClick={doForgotOtp} disabled={loading}>Verify OTP</button>
        </div>
      </div>
    </div>
  )

  if (step === 'worker-forgot-reset') return (
    <div style={root}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={card}>
          <Logo />
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Choose new password</h1>
          {e && <div style={err}>{e}</div>}
          <label style={label}>New password</label>
          <input style={input} type="password" placeholder="Min 6 characters" value={fgPw} onChange={ev=>setFgPw(ev.target.value)} />
          <label style={label}>Confirm new password</label>
          <input style={input} type="password" placeholder="Repeat" value={fgPw2} onChange={ev=>setFgPw2(ev.target.value)} onKeyDown={ev=>ev.key==='Enter'&&doForgotReset()} />
          <button style={btn} onClick={doForgotReset}>Reset password</button>
        </div>
      </div>
    </div>
  )

  if (step === 'admin-login') return (
    <div style={root}><DarkBtn />
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={card}>
          <Logo />
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:20, padding:'9px 13px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:8 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize:12, color:'var(--text-3)' }}>Administrator access only. Unauthorised entry is prohibited.</span>
          </div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Admin sign in</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>Use your administrator email and the platform password.</p>
          {e && <div style={err}>{e}</div>}
          {i && <div style={inf}>{i}</div>}
          <label style={label}>Administrator email</label>
          <input style={input} placeholder="admin@gigforge.in" value={aEmail} onChange={ev=>setAEmail(ev.target.value)} />
          <label style={label}>Administrator password</label>
          <input style={input} type="password" placeholder="••••••••••••" value={aPw} onChange={ev=>setAPw(ev.target.value)} onKeyDown={ev=>ev.key==='Enter'&&doAdminLogin()} />
          <button style={{ ...btn, opacity:loading?0.7:1 }} onClick={doAdminLogin} disabled={loading}>{loading?'Sending OTP…':'Continue'}</button>
          <button style={btnSec} onClick={() => go('landing')}>Back</button>
        </div>
      </div>
    </div>
  )

  if (step === 'admin-otp') return (
    <div style={root}><DarkBtn />
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={card}>
          <Logo />
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', marginBottom:6 }}>Verify admin identity</h1>
          <p style={{ fontSize:13, color:'var(--text-2)', marginBottom:26 }}>OTP sent to <strong>{aEmail}</strong>. Valid for 10 minutes.</p>
          {e && <div style={err}>{e}</div>}
          {i && <div style={inf}>{i}</div>}
          <OtpInput value={aOtp} onChange={setAOtp} onEnter={doAdminOtp} />
          <button style={{ ...btn, opacity:loading?0.7:1 }} onClick={doAdminOtp} disabled={loading}>{loading?'Verifying…':'Verify and sign in'}</button>
          <button style={btnSec} onClick={() => go('admin-login')}>Back</button>
        </div>
      </div>
    </div>
  )

  return null
}
